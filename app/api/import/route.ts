import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.staff.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { type, data } = await request.json();
    if (!type || !Array.isArray(data)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const staffId = session.staff.id;

    if (type === 'products') {
      const rowsToUpsert = data.map(row => ({
        sku: row.SKU,
        name: row.Name,
        description: row.Description || null,
        unit_price: parseFloat(row.UnitPrice) || 0,
        is_active: true
      })).filter(row => row.sku && row.name);
      
      if (rowsToUpsert.length === 0) return NextResponse.json({ error: 'No valid rows found' }, { status: 400 });

      const { error } = await supabase.from('products').upsert(rowsToUpsert, { onConflict: 'sku' });
      if (error) throw error;
      
      await logAudit(supabase, staffId, 'import.products', null, `Imported ${rowsToUpsert.length} products`);
      return NextResponse.json({ message: `Successfully imported ${rowsToUpsert.length} products.` });
    }

    if (type === 'branches') {
      const rowsToUpsert = data.map(row => ({
        code: row.Code,
        name: row.Name,
        is_active: true
      })).filter(row => row.code && row.name);
      
      if (rowsToUpsert.length === 0) return NextResponse.json({ error: 'No valid rows found' }, { status: 400 });

      const { error } = await supabase.from('branches').upsert(rowsToUpsert, { onConflict: 'code' });
      if (error) throw error;
      
      await logAudit(supabase, staffId, 'import.branches', null, `Imported ${rowsToUpsert.length} branches`);
      return NextResponse.json({ message: `Successfully imported ${rowsToUpsert.length} branches.` });
    }

    if (type === 'inventory') {
      let centralAddedCount = 0;
      let branchAllocatedCount = 0;

      // 1. Fetch all required products and branches to map SKUs/Codes to UUIDs
      const skus = Array.from(new Set(data.map(d => d.SKU).filter(Boolean)));
      const branchCodes = Array.from(new Set(data.map(d => d.AllocateBranchCode).filter(Boolean)));

      if (skus.length === 0) return NextResponse.json({ error: 'No SKUs provided.' }, { status: 400 });

      const { data: productsData, error: pErr } = await supabase.from('products').select('id, sku, central_qty').in('sku', skus);
      if (pErr) throw pErr;
      const productMap = new Map(productsData?.map(p => [p.sku, p]));

      const { data: branchesData, error: bErr } = await supabase.from('branches').select('id, code').in('code', branchCodes);
      if (bErr) throw bErr;
      const branchMap = new Map(branchesData?.map(b => [b.code, b.id]));

      // 2. Process rows
      for (const row of data) {
        if (!row.SKU) continue;
        const product = productMap.get(row.SKU);
        if (!product) continue; // Skip invalid SKU

        const addCentral = parseInt(row.AddCentralQty, 10);
        if (!isNaN(addCentral) && addCentral > 0) {
          // Add to central stock
          const { error: updErr } = await supabase.from('products')
            .update({ central_qty: product.central_qty + addCentral })
            .eq('id', product.id);
          if (updErr) throw updErr;
          product.central_qty += addCentral; // Update local state for subsequent rows
          centralAddedCount++;
        }

        const allocBranchCode = row.AllocateBranchCode;
        const allocQty = parseInt(row.AllocateQty, 10);
        
        if (allocBranchCode && !isNaN(allocQty) && allocQty > 0) {
          const branchId = branchMap.get(allocBranchCode);
          if (!branchId) continue; // Skip invalid branch
          
          if (product.central_qty < allocQty) {
            // Not enough central stock to allocate, skip or throw error? Let's skip and maybe return a warning, but for simplicity we just throw an error since it's a bulk operation
            throw new Error(`Not enough central stock for SKU ${row.SKU} to allocate ${allocQty} to ${allocBranchCode}.`);
          }

          // allocate_central_to_branch deducts from central and adds to branch
          const { error: rpcErr } = await supabase.rpc('allocate_central_to_branch', {
            p_product_id: product.id,
            p_branch_id: branchId,
            p_qty: allocQty
          });
          if (rpcErr) throw rpcErr;
          product.central_qty -= allocQty;
          branchAllocatedCount++;
        }
      }

      await logAudit(supabase, staffId, 'import.inventory', null, `Added central stock ${centralAddedCount} times, allocated to branch ${branchAllocatedCount} times`);
      return NextResponse.json({ message: `Successfully processed ${centralAddedCount} central additions and ${branchAllocatedCount} branch allocations.` });
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });

  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function logAudit(supabase: any, userId: string, action: string, entityId: string | null, details: string) {
  try {
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action,
      entity_type: 'import',
      entity_id: entityId,
      metadata: { details }
    });
  } catch (e) {
    console.error('Failed to log audit:', e);
  }
}
