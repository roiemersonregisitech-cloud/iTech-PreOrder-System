import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasRole, canAccessBranch } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';

// GET /api/inventory — View inventory
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');
    const search = searchParams.get('search');

    const supabase = await createServiceClient();

    let query = supabase
      .from('inventory')
      .select('*, product:products(*), branch:branches(*)')
      .order('updated_at', { ascending: false });

    // Branch scoping
    if (session.staff.role !== 'super_admin') {
      query = query.eq('branch_id', session.staff.branch_id!);
    } else if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('GET /api/inventory error:', error);
      return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
    }

    // If search, filter by product name/sku client-side (Supabase doesn't support nested filtering easily)
    let filtered = data || [];
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (item: Record<string, unknown>) => {
          const product = item.product as Record<string, unknown> | null;
          return (
            (product?.name as string)?.toLowerCase().includes(searchLower) ||
            (product?.sku as string)?.toLowerCase().includes(searchLower)
          );
        }
      );
    }

    return NextResponse.json({ data: filtered });
  } catch (err) {
    console.error('GET /api/inventory error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/inventory — Adjust inventory (branch_admin+)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasRole(session.staff.role, 'branch_admin')) {
      return NextResponse.json({ error: 'Forbidden — branch_admin or higher required' }, { status: 403 });
    }

    const body = await request.json();
    const { branch_id, product_id, qty_on_hand } = body;

    if (!branch_id || !product_id || qty_on_hand === undefined || qty_on_hand === null) {
      return NextResponse.json(
        { error: 'Missing required fields: branch_id, product_id, qty_on_hand' },
        { status: 400 }
      );
    }

    if (!canAccessBranch(session.staff, branch_id)) {
      return NextResponse.json(
        { error: 'You can only adjust inventory for your own branch' },
        { status: 403 }
      );
    }

    if (qty_on_hand < 0) {
      return NextResponse.json({ error: 'qty_on_hand cannot be negative' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Upsert inventory row
    const { data, error } = await supabase
      .from('inventory')
      .upsert(
        {
          branch_id,
          product_id,
          qty_on_hand,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'branch_id,product_id',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('POST /api/inventory error:', error);
      return NextResponse.json({ error: 'Failed to update inventory' }, { status: 500 });
    }

    // Audit log
    await writeAuditLog({
      userId: session.userId,
      action: 'inventory.adjust',
      entityType: 'inventory',
      entityId: data.id,
      metadata: { branch_id, product_id, qty_on_hand },
      request,
    });

    return NextResponse.json({ data });
  } catch (err) {
    console.error('POST /api/inventory error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
