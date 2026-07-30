'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Countdown, Modal, Spinner, ActionButton, Pagination, SkeletonCard } from '@/components/ui';
import type { Reservation, Product, InventoryRow, Branch, CancelReason, Staff } from '@/lib/types';

const CANCEL_REASONS: CancelReason[] = [
  'Customer changed mind',
  'Wrong item',
  'Duplicate reservation',
  'Other',
];

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentStaff, setCurrentStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reserve form
  const [showReserveForm, setShowReserveForm] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [reserveQty, setReserveQty] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [reserveError, setReserveError] = useState('');

  // Cancel modal
  const [cancelModal, setCancelModal] = useState<{ reservationId: string } | null>(null);
  const [cancelReason, setCancelReason] = useState<CancelReason>('Customer changed mind');

  // Confirm payment modal
  const [confirmModal, setConfirmModal] = useState<{ reservation: Reservation } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  // Preorder code display
  const [preorderCode, setPreorderCode] = useState<string | null>(null);

  const fetchStaff = useCallback(async () => {
    const res = await fetch('/api/staff/me');
    if (res.ok) {
      const data = await res.json();
      if (data.staff) {
        setCurrentStaff(data.staff);
        if (data.staff.branch_id) {
          setSelectedBranch(data.staff.branch_id);
        }
      }
    }
  }, []);

  const fetchReservations = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    const res = await fetch(`/api/reservations?${params}`);
    const data = await res.json();
    if (res.ok) setReservations(data.data || []);
  }, [statusFilter]);

  const fetchInventory = useCallback(async () => {
    const res = await fetch('/api/inventory');
    const data = await res.json();
    if (res.ok) setInventory(data.data || []);
  }, []);

  const fetchProducts = useCallback(async () => {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (res.ok) setProducts(data.data || []);
  }, []);

  const fetchBranches = useCallback(async () => {
    const res = await fetch('/api/branches');
    const data = await res.json();
    if (res.ok && data.data) {
      setBranches(data.data);
      // Only set first branch if user has no assigned branch
      setSelectedBranch(prev => prev || (data.data.length > 0 ? data.data[0].id : ''));
    }
  }, []);

  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      await Promise.all([fetchStaff(), fetchReservations(), fetchInventory(), fetchProducts(), fetchBranches()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialized.current) return;
    fetchReservations();
  }, [statusFilter, fetchReservations]);

  // Auto-refresh pending reservations every 30s
  useEffect(() => {
    if (statusFilter === 'pending') {
      const interval = setInterval(fetchReservations, 30000);
      return () => clearInterval(interval);
    }
  }, [statusFilter, fetchReservations]);

  // Reserve item
  async function handleReserve() {
    setReserveError('');
    const targetBranch = selectedBranch || (branches.length > 0 ? branches[0].id : '');
    if (!targetBranch) {
      setReserveError('Please select a branch');
      return;
    }

    const inv = inventory.find(
      i => i.branch_id === targetBranch && (i.product as Product)?.id === selectedProduct
    );
    if (!inv) {
      setReserveError('Product stock not found for the selected branch');
      return;
    }

    const idempotencyKey = crypto.randomUUID();
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch_id: targetBranch,
        product_id: selectedProduct,
        qty: reserveQty,
        customer_name: customerName || null,
        customer_contact: customerContact || null,
        idempotency_key: idempotencyKey,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setReserveError(data.message || data.error || 'Failed to reserve');
      return;
    }

    // Reset form
    setShowReserveForm(false);
    setSelectedProduct('');
    setReserveQty(1);
    setCustomerName('');
    setCustomerContact('');
    setProductSearch('');
    fetchReservations();
    fetchInventory();
  }

  // Cancel reservation
  async function handleCancel() {
    if (!cancelModal) return;
    const idempotencyKey = crypto.randomUUID();
    const res = await fetch(`/api/reservations/${cancelModal.reservationId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: cancelReason, idempotency_key: idempotencyKey }),
    });

    if (res.ok) {
      setCancelModal(null);
      fetchReservations();
      fetchInventory();
    }
  }

  // Confirm payment
  async function handleConfirmPayment() {
    if (!confirmModal) return;
    const idempotencyKey = crypto.randomUUID();
    const res = await fetch(`/api/reservations/${confirmModal.reservation.id}/confirm-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: parseFloat(paymentAmount),
        idempotency_key: idempotencyKey,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      setPreorderCode(data.preorder_code);
      setConfirmModal(null);
      setPaymentAmount('');
      fetchReservations();
    }
  }

  const filteredProducts = products.filter((p: Product) =>
    p.is_active &&
    (p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
     p.sku.toLowerCase().includes(productSearch.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)' }}>Reservations</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading pending inventory locks…</p>
        </div>
        <SkeletonCard count={6} />
      </div>
    );
  }

  const totalPages = Math.ceil(reservations.length / pageSize);
  const paginatedReservations = reservations.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)' }}>Reservations</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Manage item reservations and preorders</p>
        </div>
        <button
          id="new-reservation-btn"
          onClick={() => setShowReserveForm(true)}
          style={{
            padding: '0.625rem 1.25rem', borderRadius: 'var(--radius-md)',
            background: 'var(--gradient-primary)', color: 'white', border: 'none',
            fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Reservation
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {['pending', 'confirmed', 'expired', 'cancelled', ''].map(s => (
          <button
            key={s}
            id={`filter-${s || 'all'}`}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            style={{
              padding: '0.4rem 0.9rem', borderRadius: '9999px',
              background: statusFilter === s ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: statusFilter === s ? 'white' : 'var(--text-secondary)',
              border: statusFilter === s ? 'none' : '1px solid var(--border-primary)',
              fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              textTransform: 'capitalize',
            }}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Reservation Cards */}
      {reservations.length === 0 ? (
        <div className="glass-card" style={{
          padding: '3rem', textAlign: 'center', color: 'var(--text-muted)',
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 1rem', opacity: 0.3 }}>
            <circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
          <p style={{ fontSize: '0.9rem' }}>No {statusFilter} reservations found</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
            {paginatedReservations.map((r, i) => (
            <div key={r.id} className="glass-card" style={{
              padding: '1.25rem',
              animation: `fadeIn ${150 + i * 50}ms ease-out`,
            }}>
              {/* Card Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-heading)', marginBottom: '0.2rem' }}>
                    {(r.product as Product)?.name || 'Unknown Product'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    SKU: {(r.product as Product)?.sku || 'N/A'}
                  </div>
                </div>
                <span className={`badge badge-${r.status}`}>{r.status}</span>
              </div>

              {/* Branch Allocation Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem', fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                Branch: {r.branch?.name || 'Branch'} ({r.branch?.code || 'N/A'})
              </div>

              {/* Linked Preorder Code display if confirmed */}
              {r.preorder?.preorder_code && (
                <div style={{
                  padding: '0.5rem 0.75rem', marginBottom: '0.75rem', borderRadius: 'var(--radius-md)',
                  background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Preorder Code:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--accent-success)', fontSize: '0.95rem', letterSpacing: '0.05em' }}>
                    {r.preorder.preorder_code}
                  </span>
                </div>
              )}

              {/* Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.8rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Qty: </span>
                  <span style={{ fontWeight: 600 }}>{r.qty}</span>
                </div>
                {r.customer_name && (
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Customer: </span>
                    <span style={{ fontWeight: 500 }}>{r.customer_name}</span>
                  </div>
                )}
                {r.customer_contact && (
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Contact: </span>
                    <span>{r.customer_contact}</span>
                  </div>
                )}
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Cashier: </span>
                  <span>{(r.cashier as unknown as { full_name: string })?.full_name || 'N/A'}</span>
                </div>
              </div>

              {/* Countdown for pending */}
              {r.status === 'pending' && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '0.5rem' }}>Expires in:</span>
                  <Countdown expiresAt={r.expires_at} onExpired={fetchReservations} />
                </div>
              )}

              {/* Cancel reason for cancelled */}
              {r.status === 'cancelled' && r.cancel_reason && (
                <div style={{
                  padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(107, 107, 138, 0.08)', fontSize: '0.75rem',
                  color: 'var(--text-muted)', marginBottom: '0.75rem',
                }}>
                  Reason: {r.cancel_reason}
                </div>
              )}

              {/* Action Buttons */}
              {r.status === 'pending' && (
                <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-secondary)' }}>
                  <ActionButton
                    id={`confirm-payment-${r.id}`}
                    label="Confirm Downpayment"
                    loadingLabel="Confirming…"
                    variant="primary"
                    onClick={async () => { setConfirmModal({ reservation: r }); }}
                    style={{ flex: 1 }}
                  />
                  <ActionButton
                    id={`cancel-${r.id}`}
                    label="Cancel"
                    loadingLabel="Cancelling…"
                    variant="danger"
                    onClick={async () => { setCancelModal({ reservationId: r.id }); }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={reservations.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[6, 12, 24, 48]}
          />
        </>
      )}

      {/* Reserve Form Modal */}
      <Modal isOpen={showReserveForm} onClose={() => setShowReserveForm(false)} title="New Reservation">
        <div>
          {/* Branch Selector */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              Reserving Branch
            </label>
            <select
              id="reserve-branch-select"
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              disabled={currentStaff?.role !== 'super_admin' && !!currentStaff?.branch_id}
              style={{
                width: '100%', padding: '0.6rem 0.8rem',
                background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                fontSize: '0.85rem', outline: 'none',
                opacity: (currentStaff?.role !== 'super_admin' && !!currentStaff?.branch_id) ? 0.75 : 1,
              }}
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
            {currentStaff?.role !== 'super_admin' && currentStaff?.branch_id && (
              <div style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', marginTop: '0.3rem', fontWeight: 600 }}>
                ✓ Auto-selected for your assigned branch
              </div>
            )}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              Search Product
            </label>
            <input
              id="product-search"
              type="text"
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              placeholder="Search by name or SKU…"
              style={{
                width: '100%', padding: '0.6rem 0.8rem',
                background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                fontSize: '0.85rem', outline: 'none',
              }}
            />
          </div>

          {productSearch && filteredProducts.length > 0 && !selectedProduct && (
            <div style={{
              maxHeight: '200px', overflowY: 'auto', marginBottom: '1rem',
              border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)',
            }}>
              {filteredProducts.slice(0, 10).map(p => {
                const inv = inventory.find(i => i.branch_id === selectedBranch && (i.product as Product)?.id === p.id);
                const avail = inv ? inv.qty_on_hand - inv.qty_reserved : 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedProduct(p.id); setProductSearch(p.name); }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: '100%', padding: '0.6rem 0.8rem',
                      background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-secondary)',
                      color: 'var(--text-primary)', fontSize: '0.8rem', cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>SKU: {p.sku}</div>
                    </div>
                    <span style={{
                      color: avail > 0 ? 'var(--accent-success)' : 'var(--accent-danger)',
                      fontWeight: 700, fontSize: '0.75rem',
                    }}>
                      {avail} avail
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {selectedProduct && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Quantity</label>
                  <input
                    id="reserve-qty"
                    type="number"
                    min={1}
                    value={reserveQty}
                    onChange={e => setReserveQty(parseInt(e.target.value) || 1)}
                    style={{
                      width: '100%', padding: '0.6rem 0.8rem',
                      background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                      fontSize: '0.85rem', outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Customer Name</label>
                  <input
                    id="customer-name"
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="Optional"
                    style={{
                      width: '100%', padding: '0.6rem 0.8rem',
                      background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                      fontSize: '0.85rem', outline: 'none',
                    }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Customer Contact</label>
                <input
                  id="customer-contact"
                  type="text"
                  value={customerContact}
                  onChange={e => setCustomerContact(e.target.value)}
                  placeholder="Phone or email (optional)"
                  style={{
                    width: '100%', padding: '0.6rem 0.8rem',
                    background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                    fontSize: '0.85rem', outline: 'none',
                  }}
                />
              </div>
            </>
          )}

          {reserveError && (
            <div style={{
              padding: '0.6rem', marginBottom: '1rem', borderRadius: 'var(--radius-md)',
              background: 'var(--accent-danger-bg)', color: 'var(--accent-danger)', fontSize: '0.8rem',
              border: '1px solid rgba(239, 68, 68, 0.2)',
            }}>
              {reserveError}
            </div>
          )}

          <ActionButton
            id="submit-reservation"
            label="Reserve Item"
            loadingLabel="Reserving…"
            variant="primary"
            disabled={!selectedProduct}
            onClick={handleReserve}
            style={{ width: '100%', justifyContent: 'center', padding: '0.7rem' }}
          />
        </div>
      </Modal>

      {/* Cancel Modal */}
      <Modal isOpen={!!cancelModal} onClose={() => setCancelModal(null)} title="Cancel Reservation">
        <div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            This will immediately release the reserved stock back to inventory.
          </p>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
            Reason for cancellation
          </label>
          <select
            id="cancel-reason"
            value={cancelReason}
            onChange={e => setCancelReason(e.target.value as CancelReason)}
            style={{
              width: '100%', padding: '0.6rem 0.8rem', marginBottom: '1.25rem',
              background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
              fontSize: '0.85rem', outline: 'none',
            }}
          >
            {CANCEL_REASONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <ActionButton
            id="confirm-cancel"
            label="Cancel Reservation"
            loadingLabel="Cancelling…"
            variant="danger"
            onClick={handleCancel}
            style={{ width: '100%', justifyContent: 'center', padding: '0.7rem' }}
          />
        </div>
      </Modal>

      {/* Confirm Payment Modal */}
      <Modal isOpen={!!confirmModal} onClose={() => setConfirmModal(null)} title="Confirm Downpayment">
        <div>
          {confirmModal && (
            <div style={{
              padding: '0.75rem', marginBottom: '1rem', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-tertiary)', fontSize: '0.8rem',
            }}>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                {(confirmModal.reservation.product as Product)?.name}
              </div>
              <div style={{ color: 'var(--text-muted)' }}>
                Qty: {confirmModal.reservation.qty} • Customer: {confirmModal.reservation.customer_name || 'N/A'}
              </div>
            </div>
          )}
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
            Downpayment Amount (₱)
          </label>
          <input
            id="payment-amount"
            type="number"
            min={0}
            step={0.01}
            value={paymentAmount}
            onChange={e => setPaymentAmount(e.target.value)}
            placeholder="0.00"
            style={{
              width: '100%', padding: '0.6rem 0.8rem', marginBottom: '1.25rem',
              background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
              fontSize: '1rem', fontWeight: 600, outline: 'none',
            }}
          />
          <ActionButton
            id="submit-payment"
            label="Confirm Payment"
            loadingLabel="Confirming…"
            variant="primary"
            disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
            onClick={handleConfirmPayment}
            style={{ width: '100%', justifyContent: 'center', padding: '0.7rem' }}
          />
        </div>
      </Modal>

      {/* Preorder Code Display */}
      <Modal isOpen={!!preorderCode} onClose={() => setPreorderCode(null)} title="Preorder Confirmed! 🎉">
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Downpayment received. Your preorder code is:
          </p>
          <div
            id="preorder-code-display"
            style={{
              padding: '1.25rem', marginBottom: '1rem',
              background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)',
              border: '2px solid var(--accent-success)',
              fontSize: '1.75rem', fontWeight: 800, letterSpacing: '0.1em',
              color: 'var(--accent-success)',
              fontFamily: 'monospace',
              userSelect: 'all',
            }}
          >
            {preorderCode}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button
              id="copy-preorder-code"
              onClick={() => {
                navigator.clipboard.writeText(preorderCode || '');
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
              id="print-preorder-code"
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
