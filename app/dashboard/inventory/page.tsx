'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Spinner, Modal, ActionButton, Pagination, SkeletonCard } from '@/components/ui';
import type { InventoryRow, Product, Branch } from '@/lib/types';

interface GroupedProduct {
  product: Product;
  rows: InventoryRow[];
  totalOnHand: number;
  totalReserved: number;
  totalBackordered: number;
  totalAvailable: number;
  totalDelivered: number;
}

interface DeliveredCount {
  product_id: string;
  branch_id: string;
  total_qty: number;
}

interface TransferDestination {
  branch_id: string;
  qty: string;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.8rem',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-primary)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  fontSize: '0.85rem',
  outline: 'none',
  marginBottom: '0.75rem',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: '0.3rem',
};

function ProductPicker({ 
  selectedProductId, 
  setSelectedProductId, 
  search, 
  setSearch, 
  type,
  products
}: { 
  selectedProductId: string, 
  setSelectedProductId: (id: string) => void,
  search: string,
  setSearch: (s: string) => void,
  type: 'central' | 'allocate' | 'transfer',
  products: Product[]
}) {
  const searchTerms = search.toLowerCase().split(/\s+/).filter(Boolean);
  const filteredProducts = products.filter(p => {
    if (p.is_active === false) return false;
    if (searchTerms.length === 0) return true;
    const searchTarget = `${p.name} ${p.sku}`.toLowerCase();
    return searchTerms.every(term => searchTarget.includes(term));
  });

  if (selectedProductId) {
    const p = products.find(p => p.id === selectedProductId);
    return (
      <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Selected Product</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p?.name}</div>
        </div>
        <button
          type="button"
          onClick={() => setSelectedProductId('')}
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-primary)' }}
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by name or SKU…"
        style={inputStyle}
      />
      <div className="product-picker-grid" style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem',
        maxHeight: '300px', overflowY: 'auto', padding: '0.2rem'
      }}>
        {filteredProducts.map(p => {
          const availText = `${p.central_qty || 0} in central`;
          return (
            <div
              key={p.id}
              onClick={() => { setSelectedProductId(p.id); setSearch(''); }}
              style={{
                border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-secondary)', overflow: 'hidden', cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                display: 'flex', flexDirection: 'column', height: '100%',
              }}
            >
              <div style={{ height: '120px', background: 'var(--bg-tertiary)', position: 'relative' }}>
                 {p.image_url ? (
                   <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                 ) : (
                   <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', opacity: 0.5 }}>📦</div>
                 )}
              </div>
              <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-heading)', marginBottom: '0.2rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: '0.5rem', fontFamily: 'monospace' }}>{p.sku}</div>
                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600 }}>{availText}</span>
                </div>
              </div>
            </div>
          );
        })}
        {filteredProducts.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No products found.
          </div>
        )}
      </div>
    </div>
  );
}

function BranchPicker({
  selectedBranchId,
  setSelectedBranchId,
  branches,
  placeholder = "Search branch name or code...",
  excludeBranchIds = [],
  renderOptionExtra,
  style,
}: {
  selectedBranchId: string;
  setSelectedBranchId: (id: string) => void;
  branches: Branch[];
  placeholder?: string;
  excludeBranchIds?: string[];
  renderOptionExtra?: (branchId: string) => React.ReactNode;
  style?: React.CSSProperties;
}) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const availableBranches = branches.filter(b => !excludeBranchIds.includes(b.id));

  const filteredBranches = availableBranches.filter(b => {
    if (!search) return true;
    const target = `${b.name} ${b.code}`.toLowerCase();
    const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
    return terms.every(t => target.includes(t));
  });

  const selectedBranch = branches.find(b => b.id === selectedBranchId);

  return (
    <div style={style || { position: 'relative', width: '100%', marginBottom: '0.75rem' }}>
      {selectedBranch ? (
        <div style={{ ...inputStyle, marginBottom: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => { setSelectedBranchId(''); setSearch(''); setIsOpen(true); }}>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedBranch.name} ({selectedBranch.code})
            {renderOptionExtra && (
               <span style={{ marginLeft: '0.5rem' }}>{renderOptionExtra(selectedBranch.id)}</span>
            )}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', flexShrink: 0, marginLeft: '0.5rem' }}>Change</span>
        </div>
      ) : (
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder={placeholder}
          style={{ ...inputStyle, marginBottom: 0 }}
        />
      )}
      {isOpen && !selectedBranch && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
          background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-md)', maxHeight: '200px', overflowY: 'auto',
          boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
        }}>
          {filteredBranches.map(b => (
            <div
              key={b.id}
              onClick={() => { setSelectedBranchId(b.id); setIsOpen(false); }}
              style={{
                padding: '0.6rem 0.8rem', cursor: 'pointer',
                borderBottom: '1px solid var(--border-secondary)',
                fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between',
                background: 'var(--bg-secondary)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
            >
              <span>
                <span style={{ fontWeight: 600 }}>{b.name}</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>({b.code})</span>
              </span>
              {renderOptionExtra && renderOptionExtra(b.id)}
            </div>
          ))}
          {filteredBranches.length === 0 && (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No branches found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [userRole, setUserRole] = useState<string>('cashier');
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [expandedBranchSearch, setExpandedBranchSearch] = useState<Record<string, string>>({});
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Add Central Stock Modal
  const [showAddCentral, setShowAddCentral] = useState(false);
  const [centralProductId, setCentralProductId] = useState('');
  const [centralQty, setCentralQty] = useState('');
  const [addCentralError, setAddCentralError] = useState('');

  // Allocate Central Stock Modal
  const [showAllocateCentral, setShowAllocateCentral] = useState(false);
  const [allocProductId, setAllocProductId] = useState('');
  const [allocBranchId, setAllocBranchId] = useState('');
  const [allocQty, setAllocQty] = useState('');
  const [allocError, setAllocError] = useState('');

  // Transfer Stock Modal
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferProductId, setTransferProductId] = useState('');
  const [transferSourceBranchId, setTransferSourceBranchId] = useState('');
  const [destinations, setDestinations] = useState<TransferDestination[]>([{ branch_id: '', qty: '' }]);
  const [transferError, setTransferError] = useState('');

  // Product Picker Search States
  const [centralProductSearch, setCentralProductSearch] = useState('');
  const [allocProductSearch, setAllocProductSearch] = useState('');
  const [transferProductSearch, setTransferProductSearch] = useState('');

  // Reclaim Modal
  const [reclaimItem, setReclaimItem] = useState<InventoryRow | null>(null);
  const [reclaimQty, setReclaimQty] = useState('');
  const [reclaimError, setReclaimError] = useState('');

  // SuperAdmin Edit Modal
  const [editModal, setEditModal] = useState<{ product: Product } | null>(null);
  const [editOnHand, setEditOnHand] = useState('');
  const [editReserved, setEditReserved] = useState('');
  const [editCentral, setEditCentral] = useState('');
  const [editError, setEditError] = useState('');

  // Delivered counts per product+branch
  const [deliveredCounts, setDeliveredCounts] = useState<DeliveredCount[]>([]);

  const fetchInventoryData = useCallback(async () => {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    const [invRes, prodRes, branchRes, delRes] = await Promise.all([
      fetch(`/api/inventory${params}`),
      fetch('/api/products'),
      fetch('/api/branches'),
      fetch('/api/inventory/delivered-counts'),
    ]);

    const [invData, prodData, branchData, delData] = await Promise.all([
      invRes.json(),
      prodRes.json(),
      branchRes.json(),
      delRes.json(),
    ]);

    if (invRes.ok) setInventory(invData.data || []);
    if (prodRes.ok) setProducts(prodData.data || []);
    if (branchRes.ok) setBranches(branchData.data || []);
    if (delRes.ok) setDeliveredCounts(delData.data || []);
  }, [search]);

  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      try {
        const meRes = await fetch('/api/staff/me');
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.staff) setUserRole(meData.staff.role);
        }
        await fetchInventoryData();
      } catch (err) {
        console.error('Inventory initialization error:', err);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialized.current) return;
    setPage(1);
    fetchInventoryData();
  }, [search, fetchInventoryData]);

  const isSuperAdmin = userRole === 'super_admin';

  // Build a lookup for delivered counts per product and per product+branch
  const deliveredByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const dc of deliveredCounts) {
      map.set(dc.product_id, (map.get(dc.product_id) || 0) + dc.total_qty);
    }
    return map;
  }, [deliveredCounts]);

  const deliveredByProductBranch = useMemo(() => {
    const map = new Map<string, number>();
    for (const dc of deliveredCounts) {
      map.set(`${dc.product_id}:${dc.branch_id}`, dc.total_qty);
    }
    return map;
  }, [deliveredCounts]);

  // Group inventory rows by product
  const grouped: GroupedProduct[] = useMemo(() => {
    const map = new Map<string, GroupedProduct>();

    // First map all products so even products without branch inventory show central stock
    for (const prod of products) {
      map.set(prod.id, {
        product: prod,
        rows: [],
        totalOnHand: 0,
        totalReserved: 0,
        totalBackordered: 0,
        totalAvailable: 0,
        totalDelivered: deliveredByProduct.get(prod.id) || 0,
      });
    }

    // Populate branch inventory rows
    for (const row of inventory) {
      const product = row.product as Product;
      if (!product) continue;
      const existing = map.get(product.id);
      if (existing) {
        existing.rows.push(row);
        existing.totalOnHand += row.qty_on_hand;
        existing.totalReserved += row.qty_reserved;
        existing.totalBackordered += row.qty_backordered;
        existing.totalAvailable += row.qty_on_hand - row.qty_reserved;
      } else {
        map.set(product.id, {
          product,
          rows: [row],
          totalOnHand: row.qty_on_hand,
          totalReserved: row.qty_reserved,
          totalBackordered: row.qty_backordered,
          totalAvailable: row.qty_on_hand - row.qty_reserved,
          totalDelivered: deliveredByProduct.get(product.id) || 0,
        });
      }
    }

    let result = Array.from(map.values());
    if (search) {
      const searchTerms = search.toLowerCase().split(/\s+/).filter(Boolean);
      result = result.filter(g => {
        const target = `${g.product.name} ${g.product.sku}`.toLowerCase();
        return searchTerms.every(term => target.includes(term));
      });
    }
    return result;
  }, [inventory, products, deliveredByProduct, search]);

  // Helper to get available stock for a specific branch & product
  const getBranchAvailable = (branchId: string, productId: string) => {
    const inv = inventory.find(i => i.branch_id === branchId && (i.product as Product)?.id === productId);
    return inv ? inv.qty_on_hand - inv.qty_reserved : 0;
  };

  // Actions
  async function handleAddCentralStock() {
    setAddCentralError('');
    const qtyNum = parseInt(centralQty);
    if (!centralProductId || isNaN(qtyNum) || qtyNum <= 0) {
      setAddCentralError('Please select a product and enter a positive quantity');
      return;
    }

    const res = await fetch('/api/inventory/central', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', product_id: centralProductId, qty: qtyNum }),
    });

    const data = await res.json();
    if (!res.ok) {
      setAddCentralError(data.error || 'Failed to add central stock');
      return;
    }

    setShowAddCentral(false);
    setCentralQty('');
    fetchInventoryData();
  }

  async function handleAllocateCentralStock() {
    setAllocError('');
    const qtyNum = parseInt(allocQty);
    if (!allocProductId || !allocBranchId || isNaN(qtyNum) || qtyNum <= 0) {
      setAllocError('All fields are required and quantity must be positive');
      return;
    }

    const res = await fetch('/api/inventory/central', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'allocate',
        product_id: allocProductId,
        branch_id: allocBranchId,
        qty: qtyNum,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setAllocError(data.error || 'Failed to allocate stock');
      return;
    }

    setShowAllocateCentral(false);
    setAllocQty('');
    fetchInventoryData();
  }

  async function handleTransferStock() {
    setTransferError('');

    if (!transferProductId || !transferSourceBranchId) {
      setTransferError('Please select a product and source branch.');
      return;
    }

    // Validate destinations
    const parsedDestinations = destinations.map(d => ({
      branch_id: d.branch_id,
      qty: parseInt(d.qty) || 0,
    })).filter(d => d.branch_id && d.qty > 0);

    if (parsedDestinations.length === 0) {
      setTransferError('Please specify at least one valid destination branch and quantity.');
      return;
    }

    const totalQty = parsedDestinations.reduce((sum, d) => sum + d.qty, 0);
    const sourceAvail = getBranchAvailable(transferSourceBranchId, transferProductId);

    if (totalQty > sourceAvail) {
      setTransferError(`Total transfer quantity (${totalQty}) exceeds available source stock (${sourceAvail}).`);
      return;
    }

    const res = await fetch('/api/inventory/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: transferProductId,
        source_branch_id: transferSourceBranchId,
        destinations: parsedDestinations,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setTransferError(data.error || 'Failed to transfer stock.');
      return;
    }

    setShowTransfer(false);
    setDestinations([{ branch_id: '', qty: '' }]);
    fetchInventoryData();
  }

  async function handleSuperEdit() {
    if (!editModal) return;
    setEditError('');
    const central = parseInt(editCentral);

    if (isNaN(central) || central < 0) return setEditError('Central qty must be >= 0');

    const res = await fetch('/api/inventory/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: editModal.product.id,
        central_qty: central,
      }),
    });

    if (res.ok) {
      setEditModal(null);
      fetchInventoryData();
    } else {
      const data = await res.json();
      setEditError(data.error || 'Failed to update');
    }
  }

  async function handleReclaimStock() {
    if (!reclaimItem) return;
    setReclaimError('');
    const qtyNum = parseInt(reclaimQty);
    const available = reclaimItem.qty_on_hand - reclaimItem.qty_reserved;

    if (isNaN(qtyNum) || qtyNum <= 0 || qtyNum > available) {
      setReclaimError(`Please enter a valid quantity between 1 and ${available}`);
      return;
    }

    const prod = reclaimItem.product as Product;

    const res = await fetch('/api/inventory/central', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reclaim',
        product_id: prod.id,
        branch_id: reclaimItem.branch_id,
        qty: qtyNum,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setReclaimError(data.error || 'Failed to reclaim stock');
      return;
    }

    setReclaimItem(null);
    setReclaimQty('');
    fetchInventoryData();
  }

  function toggleExpand(productId: string) {
    setExpandedProductId(prev => (prev === productId ? null : productId));
  }

  // Transfer Math Live Prediction
  const activeTransferProduct = products.find(p => p.id === transferProductId);
  const transferSourceAvail = transferSourceBranchId && transferProductId ? getBranchAvailable(transferSourceBranchId, transferProductId) : 0;
  const totalTransferQty = destinations.reduce((sum, d) => sum + (parseInt(d.qty) || 0), 0);
  const remainingSourceAvail = transferSourceAvail - totalTransferQty;
  const isTransferMathInvalid = totalTransferQty <= 0 || totalTransferQty > transferSourceAvail || !transferSourceBranchId;

  // Pagination Math
  const totalPages = Math.ceil(grouped.length / pageSize);
  const paginatedGrouped = grouped.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)' }}>Inventory</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Central warehouse and branch stock management
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            id="inventory-search"
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products or SKU…"
            disabled={loading}
            style={{ ...inputStyle, width: '220px', marginBottom: 0, opacity: loading ? 0.7 : 1 }}
          />

          {isSuperAdmin && (
            <>
              <button
                id="add-central-btn"
                onClick={() => {
                  setCentralProductId('');
                  setShowAddCentral(true);
                }}
                disabled={loading}
                style={{
                  padding: '0.55rem 0.9rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-primary)',
                  color: 'white',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  opacity: loading ? 0.7 : 1
                }}
              >
                + Add Central Stock
              </button>

              <button
                id="allocate-central-btn"
                onClick={() => {
                  setAllocProductId('');
                  setAllocBranchId(branches[0]?.id || '');
                  setShowAllocateCentral(true);
                }}
                disabled={loading}
                style={{
                  padding: '0.55rem 0.9rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  opacity: loading ? 0.7 : 1
                }}
              >
                Allocate to Branch
              </button>

              <button
                id="transfer-branch-btn"
                onClick={() => {
                  setTransferProductId('');
                  setTransferSourceBranchId(branches[0]?.id || '');
                  setDestinations([{ branch_id: branches[1]?.id || '', qty: '' }]);
                  setShowTransfer(true);
                }}
                style={{
                  padding: '0.55rem 0.9rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Transfer Stock
              </button>
            </>
          )}
        </div>
      </div>

      {/* Product List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {loading ? (
        <SkeletonCard count={5} />
      ) : grouped.length === 0 ? (
          <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No products or inventory items found
          </div>
        ) : (
          paginatedGrouped.map((group, i) => {
            const isExpanded = isSuperAdmin && expandedProductId === group.product.id;

            return (
              <div
                key={group.product.id}
                className="glass-card"
                style={{
                  overflow: 'hidden',
                  animation: `fadeIn ${100 + i * 40}ms ease-out`,
                }}
              >
                {/* Product Header Row */}
                <div
                  id={`product-row-${group.product.id}`}
                  className="inventory-product-row"
                  onClick={() => isSuperAdmin && toggleExpand(group.product.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    alignItems: 'center',
                    padding: '1rem 1.25rem',
                    cursor: isSuperAdmin ? 'pointer' : 'default',
                    userSelect: 'none',
                  }}
                >
                  {/* Left: Product info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
                    {isSuperAdmin && (
                      <svg
                        width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5"
                        style={{ transition: 'transform 0.2s ease', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    )}

                    <div style={{ width: '40px', height: '40px', borderRadius: '4px', background: 'var(--bg-tertiary)', overflow: 'hidden', flexShrink: 0 }}>
                      {group.product.image_url ? (
                        <img src={group.product.image_url} alt={group.product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', opacity: 0.5 }}>📦</div>
                      )}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-heading)' }}>{group.product.name}</span>
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(group.product.sku);
                          }}
                          title="Click to copy SKU"
                          style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600, background: 'rgba(99, 102, 241, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px', cursor: 'pointer' }}>
                          {group.product.sku}
                        </span>
                        {group.product.unit_price && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            ₱{Number(group.product.unit_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                      {isSuperAdmin && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          {group.rows.length} branch allocation{group.rows.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Summary Stock Badges */}
                  <div className="inventory-badges" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexShrink: 0 }}>
                    {/* HIDE Central Stock count for non-super-admin staff (Branch Admins & Cashiers) */}
                    {isSuperAdmin && (
                      <div style={{ textAlign: 'center', padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-md)', background: 'rgba(99, 102, 241, 0.08)' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>Central Stock</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{group.product.central_qty || 0}</div>
                          <button
                            id={`edit-central-btn-${group.product.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditModal({ product: group.product });
                              setEditCentral((group.product.central_qty || 0).toString());
                              setEditError('');
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--accent-primary)',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'flex',
                              alignItems: 'center',
                              opacity: 0.7,
                            }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
                            title="Edit Central Stock"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}

                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Branch Allocated</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{group.totalOnHand}</div>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Reserved</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: group.totalReserved > 0 ? 'var(--accent-warning)' : 'var(--text-muted)' }}>{group.totalReserved}</div>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Backordered</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: group.totalBackordered > 0 ? 'var(--accent-danger)' : 'var(--text-muted)' }}>{group.totalBackordered}</div>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Available</div>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.15rem 0.6rem', borderRadius: '9999px',
                        fontWeight: 800, fontSize: '1rem',
                        background: 'rgba(34, 197, 94, 0.12)', color: 'var(--accent-success)',
                      }}>
                        {group.totalAvailable}
                      </span>
                    </div>

                    <div style={{ textAlign: 'center', padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-md)', background: 'rgba(168, 85, 247, 0.08)' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#a855f7', textTransform: 'uppercase' }}>Delivered</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#a855f7' }}>{group.totalDelivered}</div>
                    </div>
                  </div>
                </div>

                {/* Expanded Branch Inventory Breakdown */}
                {isExpanded && (() => {
                  const searchStr = (expandedBranchSearch[group.product.id] || '').toLowerCase();
                  const filteredRows = group.rows.filter(row => {
                    if (!searchStr) return true;
                    const branch = row.branch as Branch;
                    if (!branch) return false;
                    const target = `${branch.name} ${branch.code}`.toLowerCase();
                    return searchStr.split(/\s+/).filter(Boolean).every(t => target.includes(t));
                  });

                  return (
                    <div className="responsive-table-wrapper" style={{ borderTop: '1px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>
                      <div style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-secondary)' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-heading)' }}>Branch Allocations</span>
                        {isSuperAdmin && (
                          <div style={{ position: 'relative', width: '250px' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                            <input
                              type="text"
                              placeholder="Search branch..."
                              value={expandedBranchSearch[group.product.id] || ''}
                              onChange={e => setExpandedBranchSearch(prev => ({ ...prev, [group.product.id]: e.target.value }))}
                              style={{
                                width: '100%', padding: '0.4rem 0.5rem 0.4rem 2rem',
                                borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)',
                                background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.8rem'
                              }}
                            />
                          </div>
                        )}
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                          {['Branch', 'On Hand', 'Reserved', 'Backordered', 'Available', 'Delivered', 'Last Updated', ...(isSuperAdmin ? ['Actions'] : [])].map(h => (
                            <th key={h} style={{ padding: '0.6rem 1.25rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ padding: '1rem 1.25rem', color: 'var(--text-muted)' }}>
                              {searchStr ? 'No branches found matching your search.' : 'No branch allocations yet for this product. Use "Allocate to Branch" to assign stock from Central Inventory.'}
                            </td>
                          </tr>
                        ) : (
                          filteredRows.map(row => {
                            const branch = row.branch as Branch;
                            const available = row.qty_on_hand - row.qty_reserved;
                            const branchDelivered = deliveredByProductBranch.get(`${(row.product as Product)?.id}:${row.branch_id}`) || 0;

                            return (
                              <tr key={row.id} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                                <td style={{ padding: '0.66rem 1.25rem', fontWeight: 600, color: 'var(--text-heading)' }}>
                                  {branch?.name || 'Unknown'} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({branch?.code})</span>
                                </td>
                                <td style={{ padding: '0.66rem 1.25rem', fontWeight: 700 }}>{row.qty_on_hand}</td>
                                <td style={{ padding: '0.66rem 1.25rem', color: row.qty_reserved > 0 ? 'var(--accent-warning)' : 'var(--text-muted)' }}>{row.qty_reserved}</td>
                                <td style={{ padding: '0.66rem 1.25rem', color: row.qty_backordered > 0 ? 'var(--accent-danger)' : 'var(--text-muted)' }}>{row.qty_backordered}</td>
                                <td style={{ padding: '0.66rem 1.25rem' }}>
                                  <span style={{ fontWeight: 700, color: 'var(--accent-success)' }}>{available}</span>
                                </td>
                                <td style={{ padding: '0.66rem 1.25rem' }}>
                                  <span style={{ fontWeight: 600, color: branchDelivered > 0 ? '#a855f7' : 'var(--text-muted)' }}>{branchDelivered}</span>
                                </td>
                                <td style={{ padding: '0.66rem 1.25rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                  {new Date(row.updated_at).toLocaleString()}
                                </td>
                                  <td style={{ padding: '0.66rem 1.25rem' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                      {isSuperAdmin && (
                                        <>
                                          <button
                                            id={`reclaim-btn-${row.id}`}
                                            onClick={e => {
                                              e.stopPropagation();
                                              setReclaimItem(row);
                                              setReclaimQty('1');
                                              setReclaimError('');
                                            }}
                                            style={{
                                              padding: '0.25rem 0.5rem',
                                              borderRadius: 'var(--radius-sm)',
                                              background: 'rgba(239, 68, 68, 0.1)',
                                              border: '1px solid rgba(239, 68, 68, 0.3)',
                                              color: 'var(--accent-danger)',
                                              fontSize: '0.75rem',
                                              cursor: 'pointer',
                                              fontWeight: 500,
                                            }}
                                          >
                                            Reclaim to Central
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                );
                })()}
              </div>
            );
          })
        )}

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={grouped.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[6, 12, 24, 48]}
        />
      </div>

      {/* Add Central Stock Modal */}
      <Modal isOpen={showAddCentral} onClose={() => setShowAddCentral(false)} title="Add Central Warehouse Stock">
        <div>
          <label style={labelStyle}>Select Product</label>
          <ProductPicker
            selectedProductId={centralProductId}
            setSelectedProductId={setCentralProductId}
            search={centralProductSearch}
            setSearch={setCentralProductSearch}
            type="central"
            products={products}
          />

          <label style={labelStyle}>Quantity to Add to Central Stock</label>
          <input
            id="add-central-qty"
            type="number"
            min="1"
            value={centralQty}
            onChange={e => setCentralQty(e.target.value)}
            placeholder="e.g. 50"
            style={inputStyle}
          />

          {addCentralError && (
            <div style={{ padding: '0.5rem 0.8rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', fontSize: '0.8rem', marginBottom: '1rem' }}>
              {addCentralError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setShowAddCentral(false)}
              style={{
                padding: '0.5rem 1rem',
                background: 'transparent',
                border: '1px solid var(--border-primary)',
                color: 'var(--text-secondary)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <ActionButton
              id="submit-add-central"
              label="Add Central Stock"
              loadingLabel="Adding…"
              variant="primary"
              onClick={handleAddCentralStock}
              disabled={!centralProductId || !centralQty}
            />
          </div>
        </div>
      </Modal>

      {/* Allocate Central Stock Modal */}
      <Modal isOpen={showAllocateCentral} onClose={() => setShowAllocateCentral(false)} title="Allocate Central Stock to Branch">
        <div>
          <label style={labelStyle}>Select Product</label>
          <ProductPicker
            selectedProductId={allocProductId}
            setSelectedProductId={setAllocProductId}
            search={allocProductSearch}
            setSearch={setAllocProductSearch}
            type="allocate"
            products={products}
          />

          <label style={labelStyle}>Target Branch</label>
          <BranchPicker
            selectedBranchId={allocBranchId}
            setSelectedBranchId={setAllocBranchId}
            branches={branches}
            placeholder="Search branch name or code..."
          />

          <label style={labelStyle}>Quantity to Allocate</label>
          <input
            id="alloc-central-qty"
            type="number"
            min="1"
            value={allocQty}
            onChange={e => setAllocQty(e.target.value)}
            placeholder="e.g. 10"
            style={inputStyle}
          />

          {allocError && (
            <div style={{ padding: '0.5rem 0.8rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', fontSize: '0.8rem', marginBottom: '1rem' }}>
              {allocError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setShowAllocateCentral(false)}
              style={{
                padding: '0.5rem 1rem',
                background: 'transparent',
                border: '1px solid var(--border-primary)',
                color: 'var(--text-secondary)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <ActionButton
              id="submit-allocate-central"
              label="Allocate Stock"
              loadingLabel="Allocating…"
              variant="primary"
              onClick={handleAllocateCentralStock}
              disabled={!allocProductId || !allocBranchId || !allocQty}
            />
          </div>
        </div>
      </Modal>

      {/* Transfer Stock Modal */}
      <Modal isOpen={showTransfer} onClose={() => setShowTransfer(false)} title="Transfer Stock Between Branches">
        <div>
          <label style={labelStyle}>Select Product</label>
          <ProductPicker
            selectedProductId={transferProductId}
            setSelectedProductId={setTransferProductId}
            search={transferProductSearch}
            setSearch={setTransferProductSearch}
            type="transfer"
            products={products}
          />

          <label style={labelStyle}>Source Branch</label>
          <BranchPicker
            selectedBranchId={transferSourceBranchId}
            setSelectedBranchId={setTransferSourceBranchId}
            branches={branches}
            placeholder="Search source branch..."
            renderOptionExtra={(bId) => <span style={{ color: 'var(--accent-primary)', fontSize: '0.75rem' }}>{getBranchAvailable(bId, transferProductId)} Available</span>}
          />

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Destination Branches & Quantities</label>
              <button
                type="button"
                onClick={() => setDestinations(prev => [...prev, { branch_id: '', qty: '' }])}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                + Add Destination
              </button>
            </div>

            {destinations.map((d, index) => (
              <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                <div style={{ flex: 2 }}>
                  <BranchPicker
                    selectedBranchId={d.branch_id}
                    setSelectedBranchId={(id) => {
                      setDestinations(prev => prev.map((item, idx) => idx === index ? { ...item, branch_id: id } : item));
                    }}
                    branches={branches}
                    placeholder="Search Branch..."
                    style={{ position: 'relative', width: '100%', marginBottom: 0 }}
                    excludeBranchIds={[
                      transferSourceBranchId,
                      ...destinations.map((dest, idx) => (idx !== index ? dest.branch_id : '')).filter(Boolean)
                    ]}
                  />
                </div>

                <input
                  type="number"
                  min="1"
                  value={d.qty}
                  onChange={e => {
                    const val = e.target.value;
                    setDestinations(prev => prev.map((item, idx) => idx === index ? { ...item, qty: val } : item));
                  }}
                  placeholder="Qty"
                  style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                />

                {destinations.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setDestinations(prev => prev.filter((_, idx) => idx !== index))}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: 'var(--accent-danger)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.4rem 0.6rem',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Live Math Prediction Card */}
          <div
            style={{
              padding: '0.75rem',
              borderRadius: 'var(--radius-md)',
              background: isTransferMathInvalid ? 'rgba(239, 68, 68, 0.08)' : 'rgba(34, 197, 94, 0.08)',
              border: isTransferMathInvalid ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)',
              fontSize: '0.8rem',
              marginBottom: '1rem',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: '0.3rem' }}>Live Stock Math Prediction:</div>
            <div>
              • Source Branch Available: <strong>{transferSourceAvail}</strong> →{' '}
              <strong style={{ color: remainingSourceAvail < 0 ? 'var(--accent-danger)' : 'var(--accent-success)' }}>
                {remainingSourceAvail} remaining
              </strong>
            </div>
            <div>• Total Transfer Request: <strong>{totalTransferQty}</strong></div>
            {isTransferMathInvalid && (
              <div style={{ color: 'var(--accent-danger)', fontWeight: 700, marginTop: '0.3rem' }}>
                ⚠️ Math Invalid: Requested transfer quantity exceeds available source stock!
              </div>
            )}
          </div>

          {transferError && (
            <div style={{ padding: '0.5rem 0.8rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', fontSize: '0.8rem', marginBottom: '1rem' }}>
              {transferError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setShowTransfer(false)}
              style={{
                padding: '0.5rem 1rem',
                background: 'transparent',
                border: '1px solid var(--border-primary)',
                color: 'var(--text-secondary)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <ActionButton
              id="submit-transfer"
              label="Execute Transfer"
              loadingLabel="Transferring…"
              variant="primary"
              onClick={handleTransferStock}
              disabled={isTransferMathInvalid}
            />
          </div>
        </div>
      </Modal>

      {/* Reclaim Stock Modal */}
      <Modal isOpen={!!reclaimItem} onClose={() => setReclaimItem(null)} title="Reclaim Stock to Central Inventory">
        <div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Reclaiming stock moves available branch inventory back into the <strong>Central Warehouse</strong>.
          </p>

          <label style={labelStyle}>
            Quantity to Reclaim (Available at Branch: {(reclaimItem?.qty_on_hand || 0) - (reclaimItem?.qty_reserved || 0)})
          </label>
          <input
            id="reclaim-qty-input"
            type="number"
            min="1"
            max={(reclaimItem?.qty_on_hand || 0) - (reclaimItem?.qty_reserved || 0)}
            value={reclaimQty}
            onChange={e => setReclaimQty(e.target.value)}
            style={inputStyle}
          />

          {reclaimError && (
            <div style={{ padding: '0.5rem 0.8rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', fontSize: '0.8rem', marginBottom: '1rem' }}>
              {reclaimError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setReclaimItem(null)}
              style={{
                padding: '0.5rem 1rem',
                background: 'transparent',
                border: '1px solid var(--border-primary)',
                color: 'var(--text-secondary)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <ActionButton
              id="submit-reclaim"
              label="Reclaim Stock"
              loadingLabel="Reclaiming…"
              variant="danger"
              onClick={handleReclaimStock}
              disabled={!reclaimQty}
            />
          </div>
        </div>
      </Modal>

      {/* Super Admin Edit Modal */}
      <Modal isOpen={!!editModal} onClose={() => setEditModal(null)} title="Correct Inventory Quantities">
        <div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Warning: This directly modifies inventory data without generating standard allocation logs.
            Use only for correcting human errors or syncing physical counts.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Central Warehouse Qty</label>
              <input
                type="number"
                value={editCentral}
                onChange={e => setEditCentral(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
          {editError && (
            <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', background: 'var(--accent-danger-bg)', color: 'var(--accent-danger)', fontSize: '0.8rem', marginBottom: '0.75rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              {editError}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setEditModal(null)}
              style={{
                padding: '0.625rem 1.25rem',
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <ActionButton
              id="submit-super-edit"
              label="Save Corrections"
              loadingLabel="Saving…"
              variant="primary"
              onClick={handleSuperEdit}
              disabled={!editModal || !editCentral}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
