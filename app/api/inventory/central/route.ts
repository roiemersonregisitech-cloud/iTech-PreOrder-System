import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';

// POST /api/inventory/central
// Handles: action = 'add' | 'allocate' | 'reclaim'
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
    const { action, product_id, branch_id, qty } = body;

    if (!action || !product_id || !qty || qty <= 0) {
      return NextResponse.json({ error: 'Missing required parameters or invalid qty' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    if (action === 'add') {
      // Add stock directly to Central Inventory
      const { error } = await supabase.rpc('add_central_stock', {
        p_product_id: product_id,
        p_qty: parseInt(qty),
      });

      if (error) {
        console.error('add_central_stock error:', error);
        return NextResponse.json({ error: error.message || 'Failed to add central stock' }, { status: 400 });
      }

      await writeAuditLog({
        userId: session.userId,
        action: 'inventory.central_add',
        entityType: 'product',
        entityId: product_id,
        metadata: { qty },
        request,
      });

      return NextResponse.json({ success: true, message: 'Stock added to Central Inventory' });
    } else if (action === 'allocate') {
      if (!branch_id) {
        return NextResponse.json({ error: 'Branch ID required for allocation' }, { status: 400 });
      }

      const { error } = await supabase.rpc('allocate_central_to_branch', {
        p_product_id: product_id,
        p_branch_id: branch_id,
        p_qty: parseInt(qty),
      });

      if (error) {
        console.error('allocate_central_to_branch error:', error);
        return NextResponse.json({ error: error.message || 'Failed to allocate central stock' }, { status: 400 });
      }

      await writeAuditLog({
        userId: session.userId,
        action: 'inventory.central_allocate',
        entityType: 'product',
        entityId: product_id,
        metadata: { branch_id, qty },
        request,
      });

      return NextResponse.json({ success: true, message: 'Stock allocated from Central to Branch' });
    } else if (action === 'reclaim') {
      if (!branch_id) {
        return NextResponse.json({ error: 'Branch ID required for reclaim' }, { status: 400 });
      }

      const { error } = await supabase.rpc('reclaim_branch_to_central', {
        p_product_id: product_id,
        p_branch_id: branch_id,
        p_qty: parseInt(qty),
      });

      if (error) {
        console.error('reclaim_branch_to_central error:', error);
        return NextResponse.json({ error: error.message || 'Failed to reclaim stock' }, { status: 400 });
      }

      await writeAuditLog({
        userId: session.userId,
        action: 'inventory.central_reclaim',
        entityType: 'product',
        entityId: product_id,
        metadata: { branch_id, qty },
        request,
      });

      return NextResponse.json({ success: true, message: 'Stock reclaimed from Branch to Central' });
    } else {
      return NextResponse.json({ error: 'Invalid action. Supported: add, allocate, reclaim' }, { status: 400 });
    }
  } catch (err) {
    console.error('POST /api/inventory/central error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
