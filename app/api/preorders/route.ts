import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';

// GET /api/preorders — Search preorders
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');
    const code = searchParams.get('code');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const supabase = await createServiceClient();

    let query = supabase
      .from('preorders')
      .select('*, reservation:reservations(*, product:products(*), cashier:staff!reservations_cashier_id_fkey(*)), branch:branches(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Branch scoping
    if (session.staff.role !== 'super_admin') {
      query = query.eq('branch_id', session.staff.branch_id!);
    } else if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    // Search by preorder code, customer name, or contact (partial match)
    if (code) {
      const { data: matchingReservations } = await supabase
        .from('reservations')
        .select('id')
        .or(`customer_name.ilike.%${code}%,customer_contact.ilike.%${code}%`);
        
      const matchingResIds = matchingReservations?.map(r => r.id) || [];
      
      if (matchingResIds.length > 0) {
        query = query.or(`preorder_code.ilike.%${code}%,reservation_id.in.(${matchingResIds.join(',')})`);
      } else {
        query = query.ilike('preorder_code', `%${code}%`);
      }
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('GET /api/preorders error:', error);
      return NextResponse.json({ error: 'Failed to fetch preorders' }, { status: 500 });
    }

    return NextResponse.json({
      data,
      pagination: { page, limit, total: count || 0 },
    });
  } catch (err) {
    console.error('GET /api/preorders error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
