import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServiceClient();

    // Fetch delivered items to calculate counts per product and branch
    let query = supabase.from('delivered_items').select('product_id, branch_id, qty');

    // Branch scoping
    if (session.staff.role !== 'super_admin') {
      query = query.eq('branch_id', session.staff.branch_id!);
    }

    const { data, error } = await query;

    if (error) {
      console.error('GET /api/inventory/delivered-counts error:', error);
      return NextResponse.json({ error: 'Failed to fetch delivered counts' }, { status: 500 });
    }

    // Aggregate by product_id and branch_id
    const countsMap = new Map<string, number>();

    for (const item of (data || [])) {
      const key = `${item.product_id}:${item.branch_id}`;
      countsMap.set(key, (countsMap.get(key) || 0) + item.qty);
    }

    const aggregated = Array.from(countsMap.entries()).map(([key, total_qty]) => {
      const [product_id, branch_id] = key.split(':');
      return { product_id, branch_id, total_qty };
    });

    return NextResponse.json({ data: aggregated });
  } catch (err) {
    console.error('GET /api/inventory/delivered-counts error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
