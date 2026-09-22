import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';

// GET /api/deliveries — List delivered items
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const supabase = await createServiceClient();

    let query = supabase
      .from('delivered_items')
      .select('*, branch:branches(*), product:products(*), staff:staff!delivered_items_delivered_by_fkey(*)', { count: 'exact' })
      .order('delivered_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Branch scoping
    if (session.staff.role !== 'super_admin') {
      query = query.eq('branch_id', session.staff.branch_id!);
    }

    // Search by sales order number or preorder code
    if (search) {
      query = query.or(`sales_order_number.ilike.%${search}%,preorder_code.ilike.%${search}%,customer_name.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('GET /api/deliveries error:', error);
      return NextResponse.json({ error: 'Failed to fetch deliveries' }, { status: 500 });
    }

    return NextResponse.json({
      data,
      pagination: { page, limit, total: count || 0 },
    });
  } catch (err) {
    console.error('GET /api/deliveries error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
