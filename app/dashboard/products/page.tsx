'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Spinner, Modal, ActionButton, Pagination, SkeletonTable } from '@/components/ui';
import type { Product, Staff } from '@/lib/types';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentStaff, setCurrentStaff] = useState<Staff | null>(null);
  const [backorderGlobalEnabled, setBackorderGlobalEnabled] = useState(false);

  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Create Modal
  const [showCreate, setShowCreate] = useState(false);
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [createError, setCreateError] = useState('');

  // Edit Modal
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editSku, setEditSku] = useState('');
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
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
      const [, , backorderRes] = await Promise.all([
        fetchStaff(), fetchProducts(),
        fetch('/api/settings/backorder')
      ]);
      if (backorderRes.ok) {
        const data = await backorderRes.json();
        setBackorderGlobalEnabled(data.backorder_enabled || false);
      }
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

    // Upload image if one was selected
    if (newImageFile && data.data?.id) {
      await uploadProductImage(data.data.id, newImageFile);
    }

    setShowCreate(false);
    setNewSku('');
    setNewName('');
    setNewDesc('');
    setNewPrice('');
    setNewImageFile(null);
    setNewImagePreview(null);
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
    setEditImageFile(null);
    setEditImagePreview(p.image_url || null);
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

    // Upload new image if one was selected
    if (editImageFile && editProduct.id) {
      await uploadProductImage(editProduct.id, editImageFile);
    }

    setEditProduct(null);
    setEditImageFile(null);
    setEditImagePreview(null);
    fetchProducts();
  }

  // Upload product image
  async function uploadProductImage(productId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('product_id', productId);
    await fetch('/api/products/upload-image', {
      method: 'POST',
      body: formData,
    });
  }

  // Handle image file selection
  function handleImageSelect(file: File | null, mode: 'create' | 'edit') {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      if (mode === 'create') setCreateError('Invalid image type. Use JPEG, PNG, or WebP.');
      else setEditError('Invalid image type. Use JPEG, PNG, or WebP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      if (mode === 'create') setCreateError('Image too large. Max 2MB.');
      else setEditError('Image too large. Max 2MB.');
      return;
    }
    const url = URL.createObjectURL(file);
    if (mode === 'create') {
      setNewImageFile(file);
      setNewImagePreview(url);
    } else {
      setEditImageFile(file);
      setEditImagePreview(url);
    }
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
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
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
            disabled={loading}
            style={{ ...inputStyle, width: '220px', marginBottom: 0, opacity: loading ? 0.7 : 1 }}
          />
          {isSuperAdmin && (
            <button
              id="create-product-btn"
              onClick={() => setShowCreate(true)}
              disabled={loading}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-primary)',
                color: 'white',
                border: 'none',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                whiteSpace: 'nowrap',
                opacity: loading ? 0.7 : 1
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Product
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <SkeletonTable rows={6} columns={5} />
      ) : (
      <div className="glass-card responsive-table-wrapper" style={{ overflow: 'hidden', padding: '1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
              {['Image', 'SKU', 'Product Name', 'Description', 'Unit Price', 'Status', ...(isSuperAdmin && backorderGlobalEnabled ? ['Backorder'] : []), isSuperAdmin ? 'Actions' : ''].filter(Boolean).map(h => (
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
                  <td style={{ padding: '0.5rem 1rem', width: '48px' }}>
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        style={{
                          width: '40px', height: '40px', borderRadius: 'var(--radius-sm)',
                          objectFit: 'cover', border: '1px solid var(--border-secondary)',
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '40px', height: '40px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '1rem', color: 'var(--text-muted)',
                        border: '1px solid var(--border-secondary)',
                      }}>📦</div>
                    )}
                  </td>
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
                  {isSuperAdmin && backorderGlobalEnabled && (
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await fetch(`/api/products/${p.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ backorder_allowed: !p.backorder_allowed }),
                          });
                          if (res.ok) fetchProducts();
                        }}
                        style={{
                          position: 'relative', width: '40px', height: '22px', borderRadius: '9999px',
                          border: 'none', cursor: 'pointer', transition: 'background 0.3s',
                          background: p.backorder_allowed ? 'var(--accent-warning)' : 'var(--bg-tertiary)',
                        }}
                      >
                        <span style={{
                          position: 'absolute', top: '2px', width: '18px', height: '18px', borderRadius: '50%',
                          background: 'white', transition: 'left 0.3s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                          left: p.backorder_allowed ? '20px' : '2px',
                        }} />
                      </button>
                    </td>
                  )}
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
          pageSizeOptions={[6, 12, 24, 48]}
        />
      </div>
      )}

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

          {/* Image Upload */}
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
            Product Photo (optional)
          </label>
          <div
            onClick={() => document.getElementById('new-image-input')?.click()}
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={e => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f) handleImageSelect(f, 'create'); }}
            style={{
              width: '100%', padding: newImagePreview ? '0.5rem' : '1.5rem', marginBottom: '0.75rem',
              border: '2px dashed var(--border-primary)', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-input)', cursor: 'pointer', textAlign: 'center',
              transition: 'border-color 0.2s',
            }}
          >
            {newImagePreview ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img src={newImagePreview} alt="Preview" style={{ maxHeight: '120px', borderRadius: 'var(--radius-sm)', objectFit: 'contain' }} />
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setNewImageFile(null); setNewImagePreview(null); }}
                  style={{
                    position: 'absolute', top: '-8px', right: '-8px', width: '22px', height: '22px',
                    borderRadius: '50%', background: 'var(--accent-danger)', color: 'white',
                    border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >✕</button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>📷</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click or drag to upload (JPEG, PNG, WebP — max 2MB)</div>
              </div>
            )}
            <input id="new-image-input" type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageSelect(f, 'create'); e.target.value = ''; }} />
          </div>

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

          {/* Image Upload */}
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
            Product Photo
          </label>
          <div
            onClick={() => document.getElementById('edit-image-input')?.click()}
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={e => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f) handleImageSelect(f, 'edit'); }}
            style={{
              width: '100%', padding: editImagePreview ? '0.5rem' : '1.5rem', marginBottom: '0.75rem',
              border: '2px dashed var(--border-primary)', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-input)', cursor: 'pointer', textAlign: 'center',
              transition: 'border-color 0.2s',
            }}
          >
            {editImagePreview ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img src={editImagePreview} alt="Preview" style={{ maxHeight: '120px', borderRadius: 'var(--radius-sm)', objectFit: 'contain' }} />
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setEditImageFile(null); setEditImagePreview(null); }}
                  style={{
                    position: 'absolute', top: '-8px', right: '-8px', width: '22px', height: '22px',
                    borderRadius: '50%', background: 'var(--accent-danger)', color: 'white',
                    border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >✕</button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>📷</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click or drag to upload (JPEG, PNG, WebP — max 2MB)</div>
              </div>
            )}
            <input id="edit-image-input" type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageSelect(f, 'edit'); e.target.value = ''; }} />
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
