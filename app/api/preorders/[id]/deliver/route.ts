import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasRole, canAccessBranch } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';

// POST /api/preorders/[id]/deliver — Mark a preorder as delivered
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Any role (cashier+) can mark as delivered
    if (!hasRole(session.staff.role, 'cashier')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { invoice_no_confirm } = body;

    if (!invoice_no_confirm || typeof invoice_no_confirm !== 'string' || !invoice_no_confirm.trim()) {
      return NextResponse.json(
        { error: 'You must re-type the invoice number to confirm delivery' },
        { status: 400 }
      );
    }

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
        { error: 'You can only deliver preorders for your own branch' },
        { status: 403 }
      );
    }

    if (preorder.status !== 'active') {
      return NextResponse.json(
        { error: 'This preorder is no longer active', code: 'PREORDER_NOT_ACTIVE' },
        { status: 409 }
      );
    }

    // Call the atomic Postgres function
    const { data: result, error } = await supabase.rpc('mark_preorder_delivered', {
      p_preorder_id: id,
      p_invoice_no_confirm: invoice_no_confirm.trim(),
      p_delivered_by: session.userId,
    });

    if (error) {
      if (error.message.includes('INVOICE_MISMATCH')) {
        return NextResponse.json(
          { error: 'The invoice number you entered does not match. Please re-type it accurately.', code: 'INVOICE_MISMATCH' },
          { status: 400 }
        );
      }
      if (error.message.includes('PREORDER_NOT_FOUND')) {
        return NextResponse.json({ error: 'Preorder not found' }, { status: 404 });
      }
      if (error.message.includes('PREORDER_NOT_ACTIVE')) {
        return NextResponse.json(
          { error: 'This preorder has already been fulfilled or cancelled', code: 'PREORDER_NOT_ACTIVE' },
          { status: 409 }
        );
      }
      console.error('Mark delivered error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // Audit log
    await writeAuditLog({
      userId: session.userId,
      action: 'preorder.deliver',
      entityType: 'preorder',
      entityId: id,
      metadata: {
        sales_order_number: result.sales_order_number,
        preorder_code: result.preorder_code,
        qty: result.qty,
        branch_id: preorder.branch_id,
      },
      request,
    });

    return NextResponse.json({
      sales_order_number: result.sales_order_number,
      preorder_code: result.preorder_code,
      delivered_id: result.delivered_id,
    });
  } catch (err) {
    console.error('POST /api/preorders/[id]/deliver error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
