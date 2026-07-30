import { NextRequest, NextResponse } from 'next/server';
import { getSession, canAccessBranch } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';

// POST /api/reservations/[id]/confirm-payment — Confirm downpayment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { amount, idempotency_key } = body;

    if (!amount || amount <= 0 || !idempotency_key) {
      return NextResponse.json(
        { error: 'Missing required fields: amount (positive number), idempotency_key' },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Idempotency check: see if a preorder already exists with this key
    const { data: existingPreorder } = await supabase
      .from('preorders')
      .select('preorder_code')
      .eq('idempotency_key', idempotency_key)
      .maybeSingle();

    if (existingPreorder) {
      return NextResponse.json({
        preorder_code: existingPreorder.preorder_code,
        idempotent: true,
      });
    }

    // Check reservation exists and user can access it
    const { data: reservation } = await supabase
      .from('reservations')
      .select('branch_id, status')
      .eq('id', id)
      .single();

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    if (!canAccessBranch(session.staff, reservation.branch_id)) {
      return NextResponse.json(
        { error: 'You can only confirm payments for your own branch' },
        { status: 403 }
      );
    }

    if (reservation.status !== 'pending') {
      const message = reservation.status === 'expired'
        ? 'This reservation has expired. Please create a new reservation.'
        : 'This reservation is no longer pending.';
      return NextResponse.json(
        { error: message, code: 'RESERVATION_NOT_PENDING' },
        { status: 409 }
      );
    }

    // Call the Postgres function
    const { data: preorderCode, error } = await supabase.rpc('confirm_downpayment', {
      p_reservation_id: id,
      p_amount: amount,
      p_created_by: session.userId,
      p_idempotency_key: idempotency_key,
    });

    if (error) {
      if (error.message.includes('RESERVATION_NOT_PENDING')) {
        return NextResponse.json(
          {
            error: 'This reservation just expired or was cancelled. Please re-reserve the item.',
            code: 'RESERVATION_NOT_PENDING',
          },
          { status: 409 }
        );
      }
      if (error.message.includes('RESERVATION_NOT_FOUND')) {
        return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
      }
      console.error('Confirm downpayment error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // Audit log
    await writeAuditLog({
      userId: session.userId,
      action: 'preorder.confirm',
      entityType: 'reservation',
      entityId: id,
      metadata: {
        preorder_code: preorderCode,
        downpayment_amount: amount,
        branch_id: reservation.branch_id,
      },
      request,
    });

    return NextResponse.json({
      preorder_code: preorderCode,
    });
  } catch (err) {
    console.error('POST /api/reservations/[id]/confirm-payment error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
