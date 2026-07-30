import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';

// POST /api/inventory/transfer — Transfer inventory from 1 branch to 1 or more branches
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasRole(session.staff.role, 'super_admin')) {
      return NextResponse.json({ error: 'Forbidden: Super Admin required' }, { status: 403 });
    }

    const body = await request.json();
    const { product_id, source_branch_id, destinations } = body;

    if (!product_id || !source_branch_id || !Array.isArray(destinations) || destinations.length === 0) {
      return NextResponse.json({ error: 'Missing required parameters: product_id, source_branch_id, destinations array' }, { status: 400 });
    }

    // Validate destination entries
    for (const d of destinations) {
      if (!d.branch_id || !d.qty || parseInt(d.qty) <= 0) {
        return NextResponse.json({ error: 'Each destination must have a valid branch_id and positive qty' }, { status: 400 });
      }
      if (d.branch_id === source_branch_id) {
        return NextResponse.json({ error: 'Destination branch cannot be the same as source branch' }, { status: 400 });
      }
    }

    const supabase = await createServiceClient();

    const { error } = await supabase.rpc('transfer_branch_stock', {
      p_product_id: product_id,
      p_source_branch_id: source_branch_id,
      p_destinations: destinations.map(d => ({
        branch_id: d.branch_id,
        qty: parseInt(d.qty),
      })),
    });

    if (error) {
      console.error('transfer_branch_stock error:', error);
      return NextResponse.json({ error: error.message || 'Failed to transfer stock' }, { status: 400 });
    }

    await writeAuditLog({
      userId: session.userId,
      action: 'inventory.transfer',
      entityType: 'product',
      entityId: product_id,
      metadata: { source_branch_id, destinations },
      request,
    });

    return NextResponse.json({ success: true, message: 'Stock successfully transferred between branches' });
  } catch (err) {
    console.error('POST /api/inventory/transfer error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
