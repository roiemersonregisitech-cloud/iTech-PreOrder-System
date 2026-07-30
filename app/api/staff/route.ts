import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasRole, canAccessBranch } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(session.staff.role, 'branch_admin'))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const supabase = await createServiceClient();
    let query = supabase.from('staff')
      .select('*, branch:branches(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (session.staff.role !== 'super_admin') {
      query = query.eq('branch_id', session.staff.branch_id!);
    } else if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 });

    return NextResponse.json({ data, pagination: { page, limit, total: count || 0 } });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(session.staff.role, 'branch_admin'))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { email, password, full_name, role, branch_id } = body;

    if (!email || !password || !full_name || !role || !branch_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // branch_admin can only create cashiers for their own branch
    if (session.staff.role === 'branch_admin') {
      if (role !== 'cashier') {
        return NextResponse.json({ error: 'Branch admins can only create cashier accounts' }, { status: 403 });
      }
      if (!canAccessBranch(session.staff, branch_id)) {
        return NextResponse.json({ error: 'You can only create staff for your own branch' }, { status: 403 });
      }
    }

    const supabase = await createServiceClient();

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // Create staff record
    const { data: staffData, error: staffError } = await supabase.from('staff').insert({
      id: authData.user.id,
      branch_id,
      full_name,
      role,
    }).select().single();

    if (staffError) {
      // Cleanup: delete the auth user if staff creation fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: 'Failed to create staff record' }, { status: 500 });
    }

    await writeAuditLog({
      userId: session.userId, action: 'staff.create',
      entityType: 'staff', entityId: staffData.id,
      metadata: { email, role, branch_id, full_name },
      request,
    });

    return NextResponse.json({ data: staffData }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
