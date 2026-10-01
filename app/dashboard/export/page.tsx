import { getSession } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { ExportTabs } from "@/components/export-tabs";
import { sortProductsByName } from "@/lib/sort";

export default async function ExportPage() {
  const session = await getSession();
  if (!session) return null;

  const supabase = await createServiceClient();
  const branchId = session.staff.branch_id;
  const isSuperAdmin = session.staff.role === "super_admin";

  let staffBranchName = "Unknown";
  if (branchId) {
    const { data: branchData } = await supabase.from('branches').select('name').eq('id', branchId).single();
    if (branchData) {
      staffBranchName = branchData.name;
    }
  }

  // Fetch all preorders
  const preordersQuery = supabase.from("preorders").select(`
    id,
    preorder_code,
    status,
    invoice_no,
    remarks,
    created_at,
    branch:branches(id, name),
    reservation:reservations(
      qty,
      customer_name,
      customer_contact,
      is_backorder,
      product:products(id, sku, name)
    )
  `);

  // Fetch all inventory
  const inventoryQuery = supabase.from("inventory").select(`
    id,
    branch_id,
    qty_on_hand,
    qty_reserved,
    qty_backordered,
    product_id
  `);

  // Fetch all products
  const productsQuery = supabase.from("products").select("id, sku, name, central_qty, is_active");
  
  // Fetch all branches
  const branchesQuery = supabase.from("branches").select("id, name");

  // Fetch delivered counts
  const deliveredQuery = supabase.from("delivered_items").select("product_id, branch_id, qty");

  if (!isSuperAdmin && branchId) {
    preordersQuery.eq("branch_id", branchId);
    inventoryQuery.eq("branch_id", branchId);
    deliveredQuery.eq("branch_id", branchId);
    branchesQuery.eq("id", branchId);
  }

  const [{ data: rawPreorders }, { data: rawInventory }, { data: rawDelivered }, { data: rawProducts }, { data: rawBranches }] = await Promise.all([
    preordersQuery,
    inventoryQuery,
    deliveredQuery,
    productsQuery,
    branchesQuery
  ]);

  const deliveredMap = new Map<string, number>();
  for (const item of (rawDelivered || [])) {
    const key = `${item.product_id}:${item.branch_id}`;
    deliveredMap.set(key, (deliveredMap.get(key) || 0) + item.qty);
  }

  const preorders = rawPreorders ? (rawPreorders as unknown as Array<{
    id: string;
    preorder_code: string;
    status: string;
    invoice_no: string;
    remarks: string;
    created_at: string;
    branch: { id: string; name: string } | null;
    reservation: {
      qty: number;
      customer_name: string | null;
      customer_contact: string | null;
      is_backorder: boolean;
      product: { id: string; sku: string; name: string } | null;
    } | null;
  }>).map((row) => ({
    id: row.id,
    preorder_code: row.preorder_code,
    status: row.status,
    invoice_no: row.invoice_no,
    remarks: row.remarks || "",
    created_at: row.created_at,
    branch_name: row.branch?.name || "Unknown",
    qty: row.reservation?.qty || 1,
    customer_name: row.reservation?.customer_name || "",
    customer_contact: row.reservation?.customer_contact || "",
    sku: row.reservation?.product?.sku || "",
    product_name: row.reservation?.product?.name || "",
    is_backorder: row.reservation?.is_backorder || false,
  })) : [];

  const inventoryMap = new Map<string, any>();
  for (const inv of (rawInventory || [])) {
    inventoryMap.set(`${inv.product_id}:${inv.branch_id}`, inv);
  }

  const rawInventoryMapped = [];
  
  for (const product of (rawProducts || [])) {
    if (product.is_active === false) continue;
    
    for (const branch of (rawBranches || [])) {
      const key = `${product.id}:${branch.id}`;
      const inv = inventoryMap.get(key);
      
      const qtyOnHand = inv?.qty_on_hand || 0;
      const qtyReserved = inv?.qty_reserved || 0;
      const qtyBackordered = inv?.qty_backordered || 0;
      
      rawInventoryMapped.push({
        id: inv?.id || key,
        branch_name: branch.name,
        sku: product.sku,
        product_name: product.name,
        qty_on_hand: qtyOnHand,
        qty_reserved: qtyReserved,
        qty_backordered: qtyBackordered,
        qty_available: qtyOnHand - qtyReserved,
        qty_delivered: deliveredMap.get(key) || 0,
        central_qty: product.central_qty || 0,
      });
    }
  }

  // Sort inventory naturally
  const inventory = sortProductsByName(rawInventoryMapped, (item) => item.product_name);

  // Get distinct branches and SKUs for filtering
  const preorderBranches = Array.from(new Set(preorders.map(p => p.branch_name))).sort();
  const preorderSkus = Array.from(new Set(preorders.map(p => p.sku))).sort();
  const preorderStatuses = Array.from(new Set(preorders.map(p => p.status))).sort();

  const inventoryBranches = Array.from(new Set(inventory.map(i => i.branch_name))).sort();
  const inventorySkus = Array.from(new Set(inventory.map(i => i.sku))).sort();

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)' }}>Export Data</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Filter and export your preorder and inventory data.</p>
        </div>
      </div>
      
      <ExportTabs
        isSuperAdmin={isSuperAdmin}
        staffBranchName={staffBranchName}
        preorders={preorders}
        preorderBranches={preorderBranches}
        preorderSkus={preorderSkus}
        preorderStatuses={preorderStatuses}
        inventory={inventory}
        inventoryBranches={inventoryBranches}
        inventorySkus={inventorySkus}
      />
    </div>
  );
}
