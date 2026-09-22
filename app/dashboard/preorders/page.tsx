'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Modal, ActionButton, Pagination, SkeletonCard } from '@/components/ui';
import type { Preorder, Reservation, Product } from '@/lib/types';

export default function PreordersPage() {
  const [preorders, setPreorders] = useState<Preorder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  // Deliver modal
  const [deliverModal, setDeliverModal] = useState<{ preorder: Preorder } | null>(null);
  const [confirmCode, setConfirmCode] = useState('');
  const [deliverError, setDeliverError] = useState('');

  // Sales order display
  const [salesOrderResult, setSalesOrderResult] = useState<{ sales_order_number: string; preorder_code: string } | null>(null);

  const fetchPreorders = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set('code', search);
    if (statusFilter) params.set('status', statusFilter);
    params.set('page', page.toString());
    params.set('limit', pageSize.toString());
    const res = await fetch(`/api/preorders?${params}`);
    const data = await res.json();
    if (res.ok) {
      setPreorders(data.data || []);
      setTotalItems(data.pagination?.total || 0);
    }
  }, [search, statusFilter, page, pageSize]);

  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    (async () => {
      await fetchPreorders();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialized.current) return;
    fetchPreorders();
  }, [search, statusFilter, page, pageSize, fetchPreorders]);

  // Deliver handler
  async function handleDeliver() {
    if (!deliverModal) return;
    setDeliverError('');

    if (!confirmCode.trim()) {
      setDeliverError('Please type the preorder code to confirm');
      return;
    }

    const res = await fetch(`/api/preorders/${deliverModal.preorder.id}/deliver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preorder_code_confirm: confirmCode.trim() }),
    });

    const data = await res.json();
    if (!res.ok) {
      setDeliverError(data.error || 'Failed to mark as delivered');
      return;
    }

    setSalesOrderResult({
      sales_order_number: data.sales_order_number,
      preorder_code: data.preorder_code,
    });
    setDeliverModal(null);
    setConfirmCode('');
    setDeliverError('');
    fetchPreorders();
  }

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)' }}>Preorders</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading confirmed preorders…</p>
        </div>
        <SkeletonCard count={6} />
      </div>
    );
  }

  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)' }}>Preorders</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Confirmed reservations with downpayment</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input id="preorder-search" type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by preorder code…"
          style={{ flex: '1 1 280px', padding: '0.6rem 0.8rem', background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {['', 'active', 'fulfilled', 'cancelled'].map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }} style={{
              padding: '0.4rem 0.8rem', borderRadius: '9999px',
              background: statusFilter === s ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: statusFilter === s ? 'white' : 'var(--text-secondary)',
              border: statusFilter === s ? 'none' : '1px solid var(--border-primary)',
              fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize',
            }}>{s || 'All'}</button>
          ))}
        </div>
      </div>

      {preorders.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No preorders found
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {preorders.map((p, i) => {
              const reservation = p.reservation as Reservation;
              const product = reservation?.product as Product;
              const badgeClass = p.status === 'active' ? 'badge-active' : p.status === 'fulfilled' ? 'badge-confirmed' : 'badge-cancelled';
              return (
                <div key={p.id} className="glass-card" style={{ padding: '1.25rem', animation: `fadeIn ${150 + i * 50}ms ease-out` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.1rem', color: 'var(--accent-primary)', letterSpacing: '0.05em' }}>
                      {p.preorder_code}
                    </div>
                    <span className={`badge ${badgeClass}`}>{p.status}</span>
                  </div>
                  {/* Branch Allocation Indicator */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem', fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    Allocated Branch: {p.branch?.name || 'Branch'} ({p.branch?.code || 'N/A'})
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-heading)' }}>{product?.name || 'Unknown'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SKU: {product?.sku} • Qty Reserved: {reservation?.qty}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.8rem' }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>Downpayment: </span><span style={{ fontWeight: 600, color: 'var(--accent-success)' }}>₱{Number(p.downpayment_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
                    {reservation?.customer_name && <div><span style={{ color: 'var(--text-muted)' }}>Customer: </span>{reservation.customer_name}</div>}
                    <div><span style={{ color: 'var(--text-muted)' }}>Created: </span>{new Date(p.created_at).toLocaleDateString()}</div>
                    {reservation?.customer_contact && <div><span style={{ color: 'var(--text-muted)' }}>Contact: </span>{reservation.customer_contact}</div>}
                  </div>

                  {/* Deliver Button — only for active preorders */}
                  {p.status === 'active' && (
                    <div style={{ paddingTop: '0.75rem', marginTop: '0.75rem', borderTop: '1px solid var(--border-secondary)' }}>
                      <ActionButton
                        id={`deliver-${p.id}`}
                        label="Mark as Delivered"
                        loadingLabel="Processing…"
                        variant="primary"
                        onClick={async () => {
                          setDeliverModal({ preorder: p });
                          setConfirmCode('');
                          setDeliverError('');
                        }}
                        style={{ width: '100%', justifyContent: 'center', padding: '0.6rem' }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            pageSizeOptions={[6, 12, 24, 48]}
          />
        </>
      )}

      {/* Deliver Confirmation Modal */}
      <Modal isOpen={!!deliverModal} onClose={() => setDeliverModal(null)} title="Confirm Delivery">
        <div>
          {deliverModal && (
            <div style={{
              padding: '0.75rem', marginBottom: '1rem', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-tertiary)', fontSize: '0.8rem',
            }}>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-heading)' }}>
                {(deliverModal.preorder.reservation as Reservation)?.product
                  ? ((deliverModal.preorder.reservation as Reservation).product as Product).name
                  : 'Unknown Product'}
              </div>
              <div style={{ color: 'var(--text-muted)' }}>
                Qty: {(deliverModal.preorder.reservation as Reservation)?.qty} •
                Customer: {(deliverModal.preorder.reservation as Reservation)?.customer_name || 'N/A'}
              </div>
              <div style={{ marginTop: '0.4rem', fontFamily: 'monospace', fontWeight: 800, color: 'var(--accent-primary)', fontSize: '1rem', letterSpacing: '0.05em' }}>
                {deliverModal.preorder.preorder_code}
              </div>
            </div>
          )}

          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            To confirm delivery, please <strong>re-type the preorder code</strong> exactly as shown above.
            This will deduct the item from branch inventory.
          </p>

          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
            Type Preorder Code to Confirm
          </label>
          <input
            id="deliver-confirm-code"
            type="text"
            value={confirmCode}
            onChange={e => setConfirmCode(e.target.value.toUpperCase())}
            placeholder="e.g. ASUSAYAL-A0001"
            autoComplete="off"
            style={{
              width: '100%', padding: '0.7rem 0.8rem', marginBottom: '0.5rem',
              background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
              fontSize: '1rem', fontWeight: 700, fontFamily: 'monospace',
              letterSpacing: '0.05em', outline: 'none', textTransform: 'uppercase',
            }}
          />

          {/* Match indicator */}
          {deliverModal && confirmCode.trim() && (
            <div style={{
              fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.75rem',
              color: confirmCode.trim() === deliverModal.preorder.preorder_code ? 'var(--accent-success)' : 'var(--accent-danger)',
            }}>
              {confirmCode.trim() === deliverModal.preorder.preorder_code ? '✓ Code matches' : '✗ Code does not match'}
            </div>
          )}

          {deliverError && (
            <div style={{
              padding: '0.6rem', marginBottom: '1rem', borderRadius: 'var(--radius-md)',
              background: 'var(--accent-danger-bg)', color: 'var(--accent-danger)', fontSize: '0.8rem',
              border: '1px solid rgba(239, 68, 68, 0.2)',
            }}>
              {deliverError}
            </div>
          )}

          <ActionButton
            id="submit-deliver"
            label="Confirm Delivery"
            loadingLabel="Processing Delivery…"
            variant="primary"
            disabled={!deliverModal || confirmCode.trim() !== deliverModal.preorder.preorder_code}
            onClick={handleDeliver}
            style={{ width: '100%', justifyContent: 'center', padding: '0.7rem' }}
          />
        </div>
      </Modal>

      {/* Sales Order Confirmation Display */}
      <Modal isOpen={!!salesOrderResult} onClose={() => setSalesOrderResult(null)} title="Delivery Confirmed! 🎉">
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            The item has been delivered and inventory has been updated. Your Sales Order number is:
          </p>
          <div
            id="sales-order-display"
            style={{
              padding: '1.25rem', marginBottom: '0.75rem',
              background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)',
              border: '2px solid var(--accent-success)',
              fontSize: '2rem', fontWeight: 800, letterSpacing: '0.1em',
              color: 'var(--accent-success)',
              fontFamily: 'monospace',
              userSelect: 'all',
            }}
          >
            {salesOrderResult?.sales_order_number}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Preorder: <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{salesOrderResult?.preorder_code}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button
              id="copy-sales-order"
              onClick={() => {
                navigator.clipboard.writeText(salesOrderResult?.sales_order_number || '');
              }}
              style={{
                padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)',
                color: 'var(--text-primary)', fontSize: '0.8rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.4rem',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              Copy
            </button>
            <button
              id="print-sales-order"
              onClick={() => window.print()}
              style={{
                padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)',
                color: 'var(--text-primary)', fontSize: '0.8rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.4rem',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
