'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Spinner, Pagination, SkeletonCard } from '@/components/ui';
import type { Preorder, Reservation, Product } from '@/lib/types';

export default function PreordersPage() {
  const [preorders, setPreorders] = useState<Preorder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchPreorders = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set('code', search);
    if (statusFilter) params.set('status', statusFilter);
    const res = await fetch(`/api/preorders?${params}`);
    const data = await res.json();
    if (res.ok) setPreorders(data.data || []);
  }, [search, statusFilter]);

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
  }, [search, statusFilter, fetchPreorders]);

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

  const totalPages = Math.ceil(preorders.length / pageSize);
  const paginatedPreorders = preorders.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)' }}>Preorders</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Confirmed reservations with downpayment</p>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input id="preorder-search" type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by preorder code…"
          style={{ flex: '1 1 280px', padding: '0.6rem 0.8rem', background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: '0.4rem' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
            {paginatedPreorders.map((p, i) => {
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
                </div>
              );
            })}
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={preorders.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[6, 12, 24, 48]}
          />
        </>
      )}
    </div>
  );
}
