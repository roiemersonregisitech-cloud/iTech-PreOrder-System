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
    const { inventory_id, branch_id, product_id, qty_on_hand, qty_reserved, central_qty } = body;

    if (!product_id || qty_on_hand === undefined || qty_reserved === undefined || central_qty === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (qty_on_hand < 0) return NextResponse.json({ error: 'qty_on_hand cannot be negative' }, { status: 400 });
    if (qty_reserved < 0) return NextResponse.json({ error: 'qty_reserved cannot be negative' }, { status: 400 });

    const supabase = await createServiceClient();

    // 1. Update Inventory row (if branch_id is provided, which it should be if editing a branch row)
    if (inventory_id && branch_id) {
      const { error: invError } = await supabase
        .from('inventory')
        .update({
          qty_on_hand,
          qty_reserved,
          updated_at: new Date().toISOString(),
        })
        .eq('id', inventory_id);

      if (invError) {
        console.error('Super adjust inventory error:', invError);
        return NextResponse.json({ error: 'Failed to update branch inventory' }, { status: 500 });
      }
    } else if (branch_id) {
      // Upsert if not exists
      const { error: invError } = await supabase
        .from('inventory')
        .upsert({
          branch_id,
          product_id,
          qty_on_hand,
          qty_reserved,
          updated_at: new Date().toISOString(),
        });
        
      if (invError) {
        console.error('Super adjust inventory error:', invError);
        return NextResponse.json({ error: 'Failed to create branch inventory' }, { status: 500 });
      }
    }

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
      entityId: inventory_id || product_id,
      metadata: { branch_id, product_id, qty_on_hand, qty_reserved, central_qty },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/inventory/adjust error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
