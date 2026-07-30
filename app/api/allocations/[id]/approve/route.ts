import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';

// POST /api/allocations/[id]/approve — Super Admin approves allocation request with custom qty & source
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.staff.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { approved_qty, source_type = 'central', source_branch_id, admin_notes } = body;

    const supabase = await createServiceClient();

    const { error } = await supabase.rpc('approve_allocation_request', {
      p_request_id: id,
      p_approved_by: session.userId,
      p_approved_qty: approved_qty ? parseInt(approved_qty) : null,
      p_source_type: source_type,
      p_source_branch_id: source_branch_id || null,
      p_admin_notes: admin_notes || null,
    });

    if (error) {
      if (error.message.includes('REQUEST_NOT_FOUND')) {
        return NextResponse.json({ error: 'Allocation request not found' }, { status: 404 });
      }
      if (error.message.includes('REQUEST_NOT_PENDING')) {
        return NextResponse.json({ error: 'Request is no longer pending' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message || 'Failed to approve allocation request' }, { status: 400 });
    }

    await writeAuditLog({
      userId: session.userId,
      action: 'allocation.approve',
      entityType: 'allocation_request',
      entityId: id,
      metadata: { approved_qty, source_type, source_branch_id, admin_notes },
      request,
    });

    return NextResponse.json({ status: 'approved' });
  } catch (err) {
    console.error('POST /api/allocations/[id]/approve error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
