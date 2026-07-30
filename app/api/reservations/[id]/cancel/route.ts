import { NextRequest, NextResponse } from 'next/server';
import { getSession, canAccessBranch } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';

// POST /api/reservations/[id]/cancel — Cancel a reservation
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
    const { reason, idempotency_key } = body;

    if (!reason || !idempotency_key) {
      return NextResponse.json(
        { error: 'Missing required fields: reason, idempotency_key' },
        { status: 400 }
      );
    }

    // Validate reason
    const validReasons = ['Customer changed mind', 'Wrong item', 'Duplicate reservation', 'Other'];
    if (!validReasons.includes(reason)) {
      return NextResponse.json(
        { error: 'Invalid cancel reason' },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Check reservation exists and user can access it
    const { data: reservation } = await supabase
      .from('reservations')
      .select('branch_id, status, cancel_idempotency_key')
      .eq('id', id)
      .single();

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    // Idempotency check
    if (reservation.cancel_idempotency_key === idempotency_key) {
      return NextResponse.json({ success: true, idempotent: true });
    }

    if (!canAccessBranch(session.staff, reservation.branch_id)) {
      return NextResponse.json(
        { error: 'You can only cancel reservations for your own branch' },
        { status: 403 }
      );
    }

    if (reservation.status !== 'pending') {
      return NextResponse.json(
        { error: 'Reservation is not pending', code: 'RESERVATION_NOT_PENDING' },
        { status: 409 }
      );
    }

    // Call the Postgres function
    const { error } = await supabase.rpc('cancel_reservation', {
      p_reservation_id: id,
      p_cancelled_by: session.userId,
      p_reason: reason,
      p_idempotency_key: idempotency_key,
    });

    if (error) {
      if (error.message.includes('RESERVATION_NOT_FOUND')) {
        return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
      }
      if (error.message.includes('RESERVATION_NOT_PENDING')) {
        return NextResponse.json(
          { error: 'Reservation is no longer pending — it may have expired or been cancelled already.', code: 'RESERVATION_NOT_PENDING' },
          { status: 409 }
        );
      }
      console.error('Cancel reservation error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // Audit log
    await writeAuditLog({
      userId: session.userId,
      action: 'reservation.cancel',
      entityType: 'reservation',
      entityId: id,
      metadata: { reason, branch_id: reservation.branch_id },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/reservations/[id]/cancel error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
