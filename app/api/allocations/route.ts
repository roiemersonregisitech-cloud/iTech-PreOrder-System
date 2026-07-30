import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';

// GET /api/allocations — List allocation requests
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
      .from('allocation_requests')
      .select('*, branch:branches(*), product:products(*), requester:staff!allocation_requests_requested_by_fkey(*), processor:staff!allocation_requests_processed_by_fkey(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Scoping
    if (session.staff.role !== 'super_admin') {
      if (!session.staff.branch_id) {
        return NextResponse.json({ error: 'Staff has no assigned branch' }, { status: 400 });
      }
      query = query.eq('branch_id', session.staff.branch_id);
    } else if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('GET /api/allocations error:', error);
      return NextResponse.json({ error: 'Failed to fetch allocation requests' }, { status: 500 });
    }

    return NextResponse.json({
      data,
      pagination: { page, limit, total: count || 0 },
    });
  } catch (err) {
    console.error('GET /api/allocations error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/allocations — Submit a stock allocation request
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Branch admins or super admins can request stock
    if (!hasRole(session.staff.role, 'branch_admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { branch_id, product_id, requested_qty, reason } = body;

    const targetBranchId = session.staff.role === 'super_admin' ? branch_id : session.staff.branch_id;

    if (!targetBranchId || !product_id || !requested_qty || requested_qty <= 0) {
      return NextResponse.json(
        { error: 'Missing or invalid fields: branch_id, product_id, requested_qty (must be > 0)' },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    const { data: requestId, error } = await supabase.rpc('request_allocation', {
      p_branch_id: targetBranchId,
      p_product_id: product_id,
      p_requested_qty: requested_qty,
      p_requested_by: session.userId,
      p_reason: reason || null,
    });

    if (error) {
      console.error('request_allocation RPC error:', error);
      return NextResponse.json({ error: 'Failed to submit allocation request' }, { status: 500 });
    }

    await writeAuditLog({
      userId: session.userId,
      action: 'allocation.request',
      entityType: 'allocation_request',
      entityId: requestId,
      metadata: { branch_id: targetBranchId, product_id, requested_qty, reason },
      request,
    });

    return NextResponse.json({ request_id: requestId, status: 'pending' }, { status: 201 });
  } catch (err) {
    console.error('POST /api/allocations error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
