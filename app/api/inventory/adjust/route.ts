import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';

// POST /api/inventory/adjust — SuperAdmin Inventory Correction
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.staff.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden — super_admin required' }, { status: 403 });
    }

    const body = await request.json();
    const { product_id, central_qty } = body;

    if (!product_id || central_qty === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (central_qty < 0) return NextResponse.json({ error: 'central_qty cannot be negative' }, { status: 400 });

    const supabase = await createServiceClient();

    // 2. Update Product central_qty
    const { error: prodError } = await supabase
      .from('products')
      .update({
        central_qty,
        updated_at: new Date().toISOString(),
      })
      .eq('id', product_id);

    if (prodError) {
      console.error('Super adjust product error:', prodError);
      return NextResponse.json({ error: 'Failed to update central stock' }, { status: 500 });
    }

    // Audit log
    await writeAuditLog({
      userId: session.userId,
      action: 'inventory.super_adjust',
      entityType: 'inventory',
      entityId: product_id,
      metadata: { product_id, central_qty },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/inventory/adjust error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
