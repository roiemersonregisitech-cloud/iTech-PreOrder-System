import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasRole, canAccessBranch } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';

// POST /api/reservations — Create a reservation
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasRole(session.staff.role, 'cashier')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { branch_id, product_id, qty, customer_name, customer_contact, idempotency_key } = body;

    // Validate required fields
    if (!branch_id || !product_id || !qty || !idempotency_key) {
      return NextResponse.json(
        { error: 'Missing required fields: branch_id, product_id, qty, idempotency_key' },
        { status: 400 }
      );
    }

    // Cashiers can only reserve for their own branch
    if (!canAccessBranch(session.staff, branch_id)) {
      return NextResponse.json(
        { error: 'You can only create reservations for your own branch' },
        { status: 403 }
      );
    }

    const supabase = await createServiceClient();

    // Idempotency check: see if reservation already exists with this key
    const { data: existing } = await supabase
      .from('reservations')
      .select('id, status')
      .eq('idempotency_key', idempotency_key)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        reservation_id: existing.id,
        status: existing.status,
        idempotent: true,
      });
    }

    // Call the Postgres function
    const { data, error } = await supabase.rpc('reserve_item', {
      p_branch_id: branch_id,
      p_product_id: product_id,
      p_qty: qty,
      p_cashier_id: session.userId,
      p_customer_name: customer_name || null,
      p_customer_contact: customer_contact || null,
      p_idempotency_key: idempotency_key,
    });

    if (error) {
      // Map Postgres errors to HTTP status codes
      if (error.message.includes('INSUFFICIENT_STOCK')) {
        return NextResponse.json(
          { error: 'Insufficient stock', code: 'INSUFFICIENT_STOCK', message: 'Not enough stock available for this item at this branch.' },
          { status: 409 }
        );
      }
      if (error.message.includes('INVENTORY_ROW_NOT_FOUND')) {
        return NextResponse.json(
          { error: 'Item not found', code: 'INVENTORY_ROW_NOT_FOUND', message: 'This product is not available at this branch.' },
          { status: 404 }
        );
      }
      console.error('Reserve item error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // Audit log
    await writeAuditLog({
      userId: session.userId,
      action: 'reservation.create',
      entityType: 'reservation',
      entityId: data,
      metadata: { branch_id, product_id, qty, customer_name },
      request,
    });

    return NextResponse.json({ reservation_id: data, status: 'pending' }, { status: 201 });
  } catch (err) {
    console.error('POST /api/reservations error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/reservations — List/filter reservations
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const supabase = await createServiceClient();

    let query = supabase
      .from('reservations')
      .select('*, product:products(*), branch:branches(*), cashier:staff!reservations_cashier_id_fkey(*), preorder:preorders(preorder_code, downpayment_amount)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Branch scoping
    if (session.staff.role !== 'super_admin') {
      query = query.eq('branch_id', session.staff.branch_id!);
    } else if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('GET /api/reservations error:', error);
      return NextResponse.json({ error: 'Failed to fetch reservations' }, { status: 500 });
    }

    return NextResponse.json({
      data,
      pagination: { page, limit, total: count || 0 },
    });
  } catch (err) {
    console.error('GET /api/reservations error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
