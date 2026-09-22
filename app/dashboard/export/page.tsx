import { getSession } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { ExportManager } from "@/components/export-manager";

export default async function ExportPage() {
  const session = await getSession();
  if (!session) return null;

  const supabase = await createServiceClient();
  const branchId = session.staff.branch_id;
  const isSuperAdmin = session.staff.role === "super_admin";

  // Fetch all preorders
  const preordersQuery = supabase.from("preorders").select(`
    id,
    preorder_code,
    status,
    downpayment_amount,
    created_at,
    branch:branches(id, name),
    reservation:reservations(
      qty,
      customer_name,
      customer_contact,
      product:products(id, sku, name)
    )
  `);

  if (!isSuperAdmin && branchId) {
    preordersQuery.eq("branch_id", branchId);
  }

  const { data: rawData } = await preordersQuery;

  const preorders = rawData ? (rawData as unknown as Array<{
    id: string;
    preorder_code: string;
    status: string;
    downpayment_amount: number;
    created_at: string;
    branch: { id: string; name: string } | null;
    reservation: {
      qty: number;
      customer_name: string | null;
      customer_contact: string | null;
      product: { id: string; sku: string; name: string } | null;
    } | null;
  }>).map((row) => ({
    id: row.id,
    preorder_code: row.preorder_code,
    status: row.status,
    downpayment_amount: row.downpayment_amount,
    created_at: row.created_at,
    branch_name: row.branch?.name || "Unknown",
    qty: row.reservation?.qty || 1,
    customer_name: row.reservation?.customer_name || "",
    customer_contact: row.reservation?.customer_contact || "",
    sku: row.reservation?.product?.sku || "",
    product_name: row.reservation?.product?.name || "",
  })) : [];

  // Get distinct branches and SKUs for filtering
  const branches = Array.from(new Set(preorders.map(p => p.branch_name))).sort();
  const skus = Array.from(new Set(preorders.map(p => p.sku))).sort();
  const statuses = Array.from(new Set(preorders.map(p => p.status))).sort();

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)' }}>Export Data</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Filter and export your preorder data.</p>
        </div>
      </div>
      
      <ExportManager 
        data={preorders} 
        branches={branches} 
        skus={skus} 
        statuses={statuses} 
      />
    </div>
  );
}
