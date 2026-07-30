'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Spinner, Modal, ActionButton, Pagination, SkeletonTable } from '@/components/ui';
import type { Product, Staff } from '@/lib/types';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentStaff, setCurrentStaff] = useState<Staff | null>(null);

  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Create Modal
  const [showCreate, setShowCreate] = useState(false);
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [createError, setCreateError] = useState('');

  // Edit Modal
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editSku, setEditSku] = useState('');
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editError, setEditError] = useState('');

  // Delete Modal
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const fetchStaff = useCallback(async () => {
    const res = await fetch('/api/staff/me');
    if (res.ok) {
      const data = await res.json();
      setCurrentStaff(data.staff);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await fetch(`/api/products${params}`);
    const data = await res.json();
    if (res.ok) setProducts(data.data || []);
  }, [search]);

  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      await Promise.all([fetchStaff(), fetchProducts()]);
      setLoading(false);
    })();
  }, [fetchStaff, fetchProducts]);

  useEffect(() => {
    if (!initialized.current) return;
    setPage(1);
    fetchProducts();
  }, [search, fetchProducts]);

  const isSuperAdmin = currentStaff?.role === 'super_admin';

  // Handle Create Product
  async function handleCreate() {
    setCreateError('');
    if (!newSku.trim() || !newName.trim()) {
      setCreateError('SKU and Product Name are required.');
      return;
    }

    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku: newSku.trim().toUpperCase(),
        name: newName.trim(),
        description: newDesc.trim() || null,
        unit_price: newPrice ? parseFloat(newPrice) : null,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setCreateError(data.error || 'Failed to create product');
      return;
    }

    setShowCreate(false);
    setNewSku('');
    setNewName('');
    setNewDesc('');
    setNewPrice('');
    fetchProducts();
  }

  // Handle Edit Product
  function openEdit(p: Product) {
    setEditProduct(p);
    setEditSku(p.sku);
    setEditName(p.name);
    setEditDesc(p.description || '');
    setEditPrice(p.unit_price !== null ? String(p.unit_price) : '');
    setEditActive(p.is_active);
    setEditError('');
  }

  async function handleUpdate() {
    if (!editProduct) return;
    setEditError('');

    if (!editSku.trim() || !editName.trim()) {
      setEditError('SKU and Product Name cannot be empty.');
      return;
    }

    const res = await fetch(`/api/products/${editProduct.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku: editSku.trim().toUpperCase(),
        name: editName.trim(),
        description: editDesc.trim() || null,
        unit_price: editPrice ? parseFloat(editPrice) : null,
        is_active: editActive,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setEditError(data.error || 'Failed to update product');
      return;
    }

    setEditProduct(null);
    fetchProducts();
  }

  // Handle Delete Product
  async function handleDelete() {
    if (!deleteProduct) return;
    setDeleteError('');

    const res = await fetch(`/api/products/${deleteProduct.id}`, {
      method: 'DELETE',
    });

    const data = await res.json();
    if (!res.ok) {
      setDeleteError(data.error || 'Failed to delete product');
      return;
    }

    setDeleteProduct(null);
    fetchProducts();
  }

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)' }}>Products</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading catalog items…</p>
        </div>
        <SkeletonTable rows={6} columns={5} />
      </div>
    );
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

  const totalPages = Math.ceil(products.length / pageSize);
  const paginatedProducts = products.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)' }}>Products</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Manage catalog items, pricing, and availability</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            id="product-search-input"
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products or SKU…"
            style={{ ...inputStyle, width: '220px', marginBottom: 0 }}
          />
          {isSuperAdmin && (
            <button
              id="create-product-btn"
              onClick={() => setShowCreate(true)}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-primary)',
                color: 'white',
                border: 'none',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                whiteSpace: 'nowrap',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Product
            </button>
          )}
        </div>
      </div>

      {/* Product Table */}
      <div className="glass-card" style={{ overflow: 'hidden', padding: '1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
              {['SKU', 'Product Name', 'Description', 'Unit Price', 'Status', isSuperAdmin ? 'Actions' : ''].filter(Boolean).map(h => (
                <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No products found
                </td>
              </tr>
            ) : (
              paginatedProducts.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border-secondary)', opacity: p.is_active ? 1 : 0.6 }}>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-primary)' }}>{p.sku}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-heading)' }}>{p.name}</td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description || '—'}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {p.unit_price ? `₱${Number(p.unit_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span className={`badge ${p.is_active ? 'badge-confirmed' : 'badge-cancelled'}`}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {isSuperAdmin && (
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          id={`edit-prod-${p.id}`}
                          onClick={() => openEdit(p)}
                          style={{
                            padding: '0.3rem 0.6rem',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-primary)',
                            color: 'var(--text-primary)',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            fontWeight: 500,
                          }}
                        >
                          Edit
                        </button>
                        <button
                          id={`delete-prod-${p.id}`}
                          onClick={() => {
                            setDeleteProduct(p);
                            setDeleteError('');
                          }}
                          style={{
                            padding: '0.3rem 0.6rem',
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: 'var(--accent-danger)',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            fontWeight: 500,
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={products.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[5, 10, 20, 50]}
        />
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add New Product">
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
            Product SKU *
          </label>
          <input
            id="new-sku-input"
            type="text"
            value={newSku}
            onChange={e => setNewSku(e.target.value)}
            placeholder="e.g. LAP-MAC-M3"
            style={inputStyle}
          />

          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
            Product Name *
          </label>
          <input
            id="new-name-input"
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="e.g. MacBook Pro 14 inch"
            style={inputStyle}
          />

          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
            Description
          </label>
          <textarea
            id="new-desc-input"
            rows={2}
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="Product details, specs…"
            style={{ ...inputStyle, resize: 'none' }}
          />

          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
            Unit Price (₱)
          </label>
          <input
            id="new-price-input"
            type="number"
            step="0.01"
            value={newPrice}
            onChange={e => setNewPrice(e.target.value)}
            placeholder="e.g. 89990"
            style={inputStyle}
          />

          {createError && (
            <div style={{ padding: '0.5rem 0.8rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', fontSize: '0.8rem', marginBottom: '1rem' }}>
              {createError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
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
              id="submit-create-product"
              label="Create Product"
              loadingLabel="Creating…"
              variant="primary"
              onClick={handleCreate}
              disabled={!newSku || !newName}
            />
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editProduct} onClose={() => setEditProduct(null)} title="Edit Product">
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
            Product SKU *
          </label>
          <input
            id="edit-sku-input"
            type="text"
            value={editSku}
            onChange={e => setEditSku(e.target.value)}
            style={inputStyle}
          />

          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
            Product Name *
          </label>
          <input
            id="edit-name-input"
            type="text"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            style={inputStyle}
          />

          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
            Description
          </label>
          <textarea
            id="edit-desc-input"
            rows={2}
            value={editDesc}
            onChange={e => setEditDesc(e.target.value)}
            style={{ ...inputStyle, resize: 'none' }}
          />

          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
            Unit Price (₱)
          </label>
          <input
            id="edit-price-input"
            type="number"
            step="0.01"
            value={editPrice}
            onChange={e => setEditPrice(e.target.value)}
            style={inputStyle}
          />

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={editActive}
                onChange={e => setEditActive(e.target.checked)}
              />
              Active Product
            </label>
          </div>

          {editError && (
            <div style={{ padding: '0.5rem 0.8rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', fontSize: '0.8rem', marginBottom: '1rem' }}>
              {editError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setEditProduct(null)}
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
              id="submit-edit-product"
              label="Save Changes"
              loadingLabel="Saving…"
              variant="primary"
              onClick={handleUpdate}
              disabled={!editSku || !editName}
            />
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteProduct} onClose={() => setDeleteProduct(null)} title="Delete Product">
        <div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Are you sure you want to delete <strong>{deleteProduct?.name}</strong> ({deleteProduct?.sku})?
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Note: If this product has historical reservations or active inventory records, it will be safely deactivated instead of permanently deleted to preserve audit logs.
          </p>

          {deleteError && (
            <div style={{ padding: '0.5rem 0.8rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', fontSize: '0.8rem', marginBottom: '1rem' }}>
              {deleteError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setDeleteProduct(null)}
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
              id="confirm-delete-product"
              label="Delete Product"
              loadingLabel="Deleting…"
              variant="danger"
              onClick={handleDelete}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
