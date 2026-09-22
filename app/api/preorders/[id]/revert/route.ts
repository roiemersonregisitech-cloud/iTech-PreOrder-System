import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasRole, canAccessBranch } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';

// POST /api/preorders/[id]/revert — Revert a fulfilled preorder back to active
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only branch_admin or super_admin can revert
    if (!hasRole(session.staff.role, 'branch_admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
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
        { error: 'You can only revert preorders for your own branch' },
        { status: 403 }
      );
    }

    if (preorder.status !== 'fulfilled') {
      return NextResponse.json(
        { error: 'Only fulfilled preorders can be reverted', code: 'PREORDER_NOT_FULFILLED' },
        { status: 400 }
      );
    }

    // Call the atomic Postgres function
    const { data: result, error } = await supabase.rpc('revert_preorder_delivered', {
      p_preorder_id: id,
      p_reverted_by: session.userId,
    });

    if (error) {
      console.error('Revert preorder error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit log
    await writeAuditLog({
      userId: session.userId,
      action: 'preorder.revert',
      entityType: 'preorder',
      entityId: id,
      metadata: {
        preorder_code: result.preorder_code,
        qty_reverted: result.qty_reverted,
        branch_id: preorder.branch_id,
      },
      request,
    });

    return NextResponse.json({
      preorder_code: result.preorder_code,
      qty_reverted: result.qty_reverted,
    });
  } catch (err) {
    console.error('POST /api/preorders/[id]/revert error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
