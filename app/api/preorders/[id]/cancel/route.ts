import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasRole, canAccessBranch } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';

// POST /api/preorders/[id]/cancel — Cancel an active preorder
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only branch_admin or super_admin can cancel
    if (!hasRole(session.staff.role, 'branch_admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { reason } = body;

    const supabase = await createServiceClient();

    // Verify preorder exists and user can access the branch
    const { data: preorder } = await supabase
      .from('preorders')
      .select('branch_id, status, preorder_code')
      .eq('id', id)
      .single();

    if (!preorder) {
      return NextResponse.json({ error: 'Preorder not found' }, { status: 404 });
    }

    if (!canAccessBranch(session.staff, preorder.branch_id)) {
      return NextResponse.json(
        { error: 'You can only cancel preorders for your own branch' },
        { status: 403 }
      );
    }

    if (preorder.status !== 'active') {
      return NextResponse.json(
        { error: 'Only active preorders can be cancelled', code: 'PREORDER_NOT_ACTIVE' },
        { status: 400 }
      );
    }

    // Call the atomic Postgres function
    const { data: result, error } = await supabase.rpc('cancel_preorder', {
      p_preorder_id: id,
      p_cancelled_by: session.userId,
    });

    if (error) {
      console.error('Cancel preorder error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit log
    await writeAuditLog({
      userId: session.userId,
      action: 'preorder.cancel',
      entityType: 'preorder',
      entityId: id,
      metadata: {
        preorder_code: result.preorder_code,
        qty_released: result.qty_released,
        branch_id: preorder.branch_id,
        reason: reason || 'No reason provided',
      },
      request,
    });

    return NextResponse.json({
      preorder_code: result.preorder_code,
      qty_released: result.qty_released,
    });
  } catch (err) {
    console.error('POST /api/preorders/[id]/cancel error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
