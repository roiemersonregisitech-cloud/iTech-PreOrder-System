import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';

// POST /api/allocations/[id]/reject — Super Admin rejects allocation request
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
    const { admin_notes } = body;

    const supabase = await createServiceClient();

    const { error } = await supabase.rpc('reject_allocation_request', {
      p_request_id: id,
      p_rejected_by: session.userId,
      p_admin_notes: admin_notes || null,
    });

    if (error) {
      if (error.message.includes('REQUEST_NOT_FOUND')) {
        return NextResponse.json({ error: 'Allocation request not found' }, { status: 404 });
      }
      if (error.message.includes('REQUEST_NOT_PENDING')) {
        return NextResponse.json({ error: 'Request is no longer pending' }, { status: 409 });
      }
      console.error('reject_allocation_request error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    await writeAuditLog({
      userId: session.userId,
      action: 'allocation.reject',
      entityType: 'allocation_request',
      entityId: id,
      metadata: { admin_notes },
      request,
    });

    return NextResponse.json({ status: 'rejected' });
  } catch (err) {
    console.error('POST /api/allocations/[id]/reject error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
