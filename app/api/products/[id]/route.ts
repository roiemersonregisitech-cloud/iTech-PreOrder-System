import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';

// GET /api/products/[id] — Fetch single product
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from('products')
      .select('*, inventory(*, branch:branches(*))')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('GET /api/products/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/products/[id] — Update product details
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasRole(session.staff.role, 'super_admin')) {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { sku, name, description, unit_price, is_active, image_url, backorder_allowed } = body;

    const updateData: Record<string, unknown> = {};
    if (sku !== undefined) updateData.sku = sku.trim().toUpperCase();
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (unit_price !== undefined) updateData.unit_price = unit_price !== null ? parseFloat(unit_price) : null;
    if (is_active !== undefined) updateData.is_active = Boolean(is_active);
    if (image_url !== undefined) updateData.image_url = image_url || null;
    if (backorder_allowed !== undefined) updateData.backorder_allowed = Boolean(backorder_allowed);

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields provided for update' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating product:', error);
      if (error.code === '23505') {
        return NextResponse.json({ error: 'SKU already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message || 'Failed to update product' }, { status: 500 });
    }

    await writeAuditLog({
      userId: session.userId,
      action: 'product.update',
      entityType: 'product',
      entityId: id,
      metadata: updateData,
      request,
    });

    return NextResponse.json({ data });
  } catch (err) {
    console.error('PUT /api/products/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/products/[id] — Delete product (or deactivate if references exist)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasRole(session.staff.role, 'super_admin')) {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = await createServiceClient();

    // Check if product has active reservations or preorders
    const { count: resCount } = await supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', id);

    const { count: preCount } = await supabase
      .from('preorders')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', id);

    if ((resCount && resCount > 0) || (preCount && preCount > 0)) {
      // Safely deactivate instead of deleting to preserve historical integrity
      const { data } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', id)
        .select()
        .single();

      await writeAuditLog({
        userId: session.userId,
        action: 'product.deactivate',
        entityType: 'product',
        entityId: id,
        metadata: { reason: 'Has active reservations/preorders, deactivated instead of deleted' },
        request,
      });

      return NextResponse.json({
        message: 'Product has linked reservations/preorders; set status to inactive.',
        data,
      });
    }

    // Delete associated inventory rows first
    await supabase.from('inventory').delete().eq('product_id', id);

    // Delete product
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting product:', error);
      return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
    }

    await writeAuditLog({
      userId: session.userId,
      action: 'product.delete',
      entityType: 'product',
      entityId: id,
      metadata: { deleted: true },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/products/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
