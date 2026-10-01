import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(session.staff.role, 'branch_admin'))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { is_active, full_name, role } = body;

    const supabase = await createServiceClient();

    // Get target staff to check branch access
    const { data: target } = await supabase.from('staff').select('*').eq('id', id).single();
    if (!target) return NextResponse.json({ error: 'Staff not found' }, { status: 404 });

    // branch_admin can only manage staff in their branch
    if (session.staff.role === 'branch_admin') {
      if (target.branch_id !== session.staff.branch_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (target.role !== 'cashier') {
        return NextResponse.json({ error: 'Forbidden: Branch admins can only manage cashiers' }, { status: 403 });
      }
    }

    const updates: Record<string, unknown> = {};
    if (is_active !== undefined) updates.is_active = is_active;
    if (full_name) updates.full_name = full_name;
    if (role && session.staff.role === 'super_admin') updates.role = role;

    const { data, error } = await supabase.from('staff').update(updates).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: 'Failed to update staff' }, { status: 500 });

    const action = is_active === false ? 'staff.deactivate' : 'staff.update';
    await writeAuditLog({
      userId: session.userId, action,
      entityType: 'staff', entityId: id,
      metadata: updates, request,
    });

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(session.staff.role, 'super_admin'))
      return NextResponse.json({ error: 'Only super admins can delete staff' }, { status: 403 });

    const { id } = await params;
    const supabase = await createServiceClient();

    // Prevent self-deletion
    if (id === session.userId) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
    }

    // Get target staff
    const { data: target } = await supabase.from('staff').select('*').eq('id', id).single();
    if (!target) return NextResponse.json({ error: 'Staff not found' }, { status: 404 });

    // Delete staff record first
    const { error: staffError } = await supabase.from('staff').delete().eq('id', id);
    if (staffError) {
      console.error('Failed to delete staff record:', staffError);
      return NextResponse.json({ error: 'Failed to delete staff. They may have associated records — try deactivating instead.' }, { status: 500 });
    }

    // Delete auth user
    const { error: authError } = await supabase.auth.admin.deleteUser(id);
    if (authError) {
      console.error('Failed to delete auth user:', authError);
      // Staff record already deleted, log but don't fail
    }

    await writeAuditLog({
      userId: session.userId, action: 'staff.delete',
      entityType: 'staff', entityId: id,
      metadata: { deleted_name: target.full_name, deleted_role: target.role },
      request,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
