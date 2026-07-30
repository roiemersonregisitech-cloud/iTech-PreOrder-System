import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';

// POST /api/allocations/direct — Super Admin direct allocation adjustment (add or reclaim stock)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.staff.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { branch_id, product_id, action, qty, reason } = body;

    if (!branch_id || !product_id || !action || !qty || qty <= 0) {
      return NextResponse.json(
        { error: 'Missing or invalid fields: branch_id, product_id, action (add|reclaim), qty (>0)' },
        { status: 400 }
      );
    }

    if (!['add', 'reclaim'].includes(action)) {
      return NextResponse.json({ error: 'Action must be "add" or "reclaim"' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const { error } = await supabase.rpc('adjust_branch_allocation', {
      p_branch_id: branch_id,
      p_product_id: product_id,
      p_action: action,
      p_qty: qty,
      p_admin_id: session.userId,
      p_reason: reason || null,
    });

    if (error) {
      if (error.message.includes('CANNOT_RECLAIM_RESERVED_STOCK')) {
        return NextResponse.json(
          { error: 'Cannot reclaim stock that is currently reserved by pending customer orders' },
          { status: 409 }
        );
      }
      console.error('adjust_branch_allocation RPC error:', error);
      return NextResponse.json({ error: 'Failed to adjust allocation' }, { status: 500 });
    }

    await writeAuditLog({
      userId: session.userId,
      action: `allocation.direct_${action}`,
      entityType: 'inventory',
      entityId: branch_id,
      metadata: { branch_id, product_id, action, qty, reason },
      request,
    });

    return NextResponse.json({ success: true, message: `Successfully ${action === 'add' ? 'added' : 'reclaimed'} ${qty} units` });
  } catch (err) {
    console.error('POST /api/allocations/direct error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
