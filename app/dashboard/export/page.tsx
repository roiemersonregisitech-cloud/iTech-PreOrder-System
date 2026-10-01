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
    qty_on_hand,
    qty_reserved,
    qty_backordered,
    branch:branches(id, name),
    product:products(id, sku, name, central_qty)
  `);

  if (!isSuperAdmin && branchId) {
    preordersQuery.eq("branch_id", branchId);
    inventoryQuery.eq("branch_id", branchId);
  }

  const [{ data: rawPreorders }, { data: rawInventory }] = await Promise.all([
    preordersQuery,
    inventoryQuery
  ]);

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

  const rawInventoryMapped = rawInventory ? (rawInventory as any[]).map((row) => ({
    id: row.id,
    branch_name: row.branch?.name || "Unknown",
    sku: row.product?.sku || "",
    product_name: row.product?.name || "",
    qty_on_hand: row.qty_on_hand || 0,
    qty_reserved: row.qty_reserved || 0,
    qty_backordered: row.qty_backordered || 0,
    qty_available: (row.qty_on_hand || 0) - (row.qty_reserved || 0),
    central_qty: row.product?.central_qty || 0,
  })) : [];

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
