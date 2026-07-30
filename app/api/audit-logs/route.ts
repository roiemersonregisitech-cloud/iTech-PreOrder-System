import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(session.staff.role, 'branch_admin'))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');
    const userId = searchParams.get('user_id');
    const action = searchParams.get('action');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const supabase = await createServiceClient();
    let query = supabase.from('audit_logs')
      .select('*, user:staff(id, full_name, role, branch_id)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Branch scoping for branch_admin
    if (session.staff.role === 'branch_admin') {
      // Get all staff IDs for this branch
      const { data: branchStaff } = await supabase
        .from('staff').select('id').eq('branch_id', session.staff.branch_id!);
      const staffIds = branchStaff?.map(s => s.id) || [];
      if (staffIds.length > 0) {
        query = query.in('user_id', staffIds);
      } else {
        return NextResponse.json({ data: [], pagination: { page, limit, total: 0 } });
      }
    } else if (branchId) {
      const { data: branchStaff } = await supabase
        .from('staff').select('id').eq('branch_id', branchId);
      const staffIds = branchStaff?.map(s => s.id) || [];
      if (staffIds.length > 0) {
        query = query.in('user_id', staffIds);
      }
    }

    if (userId) query = query.eq('user_id', userId);
    if (action) query = query.eq('action', action);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo);

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });

    return NextResponse.json({ data, pagination: { page, limit, total: count || 0 } });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
