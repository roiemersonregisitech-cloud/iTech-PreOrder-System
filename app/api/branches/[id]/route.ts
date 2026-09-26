import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !hasRole(session.staff.role, 'super_admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const { name, is_active } = await request.json();

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const supabase = await createServiceClient();
    
    // Check if branch exists
    const { data: existing, error: findError } = await supabase.from('branches').select('*').eq('id', id).single();
    if (findError || !existing) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('branches')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update branch error:', error);
      return NextResponse.json({ error: 'Failed to update branch' }, { status: 500 });
    }

    await writeAuditLog({
      userId: session.userId,
      action: 'branch.update',
      entityType: 'branch',
      entityId: id,
      metadata: { previous: existing, new: updates },
      request,
    });

    return NextResponse.json({ data });
  } catch (err) {
    console.error('PATCH /api/branches/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !hasRole(session.staff.role, 'super_admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = await createServiceClient();

    // Check for staff
    const { count: staffCount } = await supabase.from('staff').select('*', { count: 'exact', head: true }).eq('branch_id', id);
    if (staffCount && staffCount > 0) {
      return NextResponse.json({ error: 'Cannot delete branch because it still has registered staff members.' }, { status: 400 });
    }

    // Check for reservations
    const { count: resCount } = await supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('branch_id', id);
    if (resCount && resCount > 0) {
      return NextResponse.json({ error: 'Cannot delete branch because it has existing reservations.' }, { status: 400 });
    }

    // Check for preorders
    const { count: preCount } = await supabase.from('preorders').select('*', { count: 'exact', head: true }).eq('branch_id', id);
    if (preCount && preCount > 0) {
      return NextResponse.json({ error: 'Cannot delete branch because it has existing preorders.' }, { status: 400 });
    }

    // Check for delivered items
    const { count: delCount } = await supabase.from('delivered_items').select('*', { count: 'exact', head: true }).eq('branch_id', id);
    if (delCount && delCount > 0) {
      return NextResponse.json({ error: 'Cannot delete branch because it has delivered items.' }, { status: 400 });
    }

    // Check inventory for non-zero stock
    const { data: invData, error: invError } = await supabase.from('inventory').select('qty_on_hand, qty_reserved, qty_backordered').eq('branch_id', id);
    if (invError) {
      return NextResponse.json({ error: 'Failed to verify inventory state' }, { status: 500 });
    }
    
    const hasStock = invData.some(inv => inv.qty_on_hand > 0 || inv.qty_reserved > 0 || (inv.qty_backordered && inv.qty_backordered > 0));
    if (hasStock) {
      return NextResponse.json({ error: 'Cannot delete branch because it has non-zero inventory stock. Transfer or clear stock first.' }, { status: 400 });
    }

    // It's safe to delete. Delete inventory, sequence, then branch.
    await supabase.from('inventory').delete().eq('branch_id', id);
    await supabase.from('branch_sequences').delete().eq('branch_id', id);
    
    const { error: delError } = await supabase.from('branches').delete().eq('id', id);
    if (delError) {
      console.error('Delete branch error:', delError);
      return NextResponse.json({ error: 'Failed to delete branch' }, { status: 500 });
    }

    await writeAuditLog({
      userId: session.userId,
      action: 'branch.delete',
      entityType: 'branch',
      entityId: id,
      metadata: { branch_id: id },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/branches/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
