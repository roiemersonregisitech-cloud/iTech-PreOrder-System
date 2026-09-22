'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Pagination, SkeletonCard } from '@/components/ui';
import type { DeliveredItem, Product, Branch, Staff } from '@/lib/types';

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<DeliveredItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [totalItems, setTotalItems] = useState(0);

  const fetchDeliveries = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('page', page.toString());
    params.set('limit', pageSize.toString());
    const res = await fetch(`/api/deliveries?${params}`);
    const data = await res.json();
    if (res.ok) {
      setDeliveries(data.data || []);
      setTotalItems(data.pagination?.total || 0);
    }
  }, [search, page, pageSize]);

  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    (async () => {
      await fetchDeliveries();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialized.current) return;
    setPage(1);
    fetchDeliveries();
  }, [search, fetchDeliveries]);

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)' }}>Deliveries</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading delivery history…</p>
        </div>
        <SkeletonCard count={6} />
      </div>
    );
  }

  const totalPages = Math.ceil(totalItems / pageSize);

  // Summary stats
  const totalDelivered = deliveries.length;
  const totalQty = deliveries.reduce((sum, d) => sum + d.qty, 0);
  const totalDownpayment = deliveries.reduce((sum, d) => sum + Number(d.downpayment_amount), 0);

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)' }}>Deliveries</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Fulfilled preorders — items released to customers</p>
      </div>

      {/* Summary Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '0.75rem', marginBottom: '1.5rem',
      }}>
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Deliveries</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{totalDelivered}</div>
        </div>
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Units Delivered</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-success)' }}>{totalQty}</div>
        </div>
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Downpayments</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-warning)' }}>₱{totalDownpayment.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '1.5rem' }}>
        <input
          id="delivery-search"
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by Sales Order, Preorder Code, or Customer…"
          style={{
            width: '100%', maxWidth: '480px', padding: '0.6rem 0.8rem',
            background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
            fontSize: '0.85rem', outline: 'none',
          }}
        />
      </div>

      {/* Deliveries Grid */}
      {deliveries.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 1rem', opacity: 0.3 }}>
            <circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>
          </svg>
          <p style={{ fontSize: '0.9rem' }}>No deliveries found{search ? ' matching your search' : ''}</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
            {deliveries.map((d, i) => {
              const product = d.product as Product | undefined;
              const branch = d.branch as Branch | undefined;
              const deliveredByStaff = d.staff as Staff | undefined;

              return (
                <div
                  key={d.id}
                  className="glass-card"
                  style={{
                    padding: '1.25rem',
                    animation: `fadeIn ${150 + i * 50}ms ease-out`,
                  }}
                >
                  {/* Card Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{
                      fontFamily: 'monospace', fontWeight: 800, fontSize: '1.15rem',
                      color: 'var(--accent-success)', letterSpacing: '0.05em',
                    }}>
                      {d.sales_order_number}
                    </div>
                    <span className="badge badge-confirmed" style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20,6 9,17 4,12"/>
                      </svg>
                      Delivered
                    </span>
                  </div>

                  {/* Preorder Code */}
                  <div style={{
                    padding: '0.35rem 0.5rem', marginBottom: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(99, 102, 241, 0.08)',
                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                    fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)',
                    fontFamily: 'monospace', letterSpacing: '0.03em',
                  }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14,2H6A2,2,0,0,0,4,4V20a2,2,0,0,0,2,2H18a2,2,0,0,0,2-2V8Z"/>
                      <polyline points="14,2 14,8 20,8"/>
                    </svg>
                    {d.preorder_code}
                  </div>

                  {/* Branch */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem', fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {branch?.name || 'Branch'} ({branch?.code || 'N/A'})
                  </div>

                  {/* Product Info */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-heading)' }}>
                      {product?.name || 'Unknown Product'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      SKU: {product?.sku || 'N/A'} • Qty: {d.qty}
                    </div>
                  </div>

                  {/* Details */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.8rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Downpayment: </span>
                      <span style={{ fontWeight: 600, color: 'var(--accent-success)' }}>
                        ₱{Number(d.downpayment_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    {d.customer_name && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Customer: </span>
                        <span style={{ fontWeight: 500 }}>{d.customer_name}</span>
                      </div>
                    )}
                    {d.customer_contact && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Contact: </span>
                        <span>{d.customer_contact}</span>
                      </div>
                    )}
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Delivered By: </span>
                      <span>{deliveredByStaff?.full_name || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Timestamp footer */}
                  <div style={{
                    paddingTop: '0.6rem', marginTop: '0.75rem',
                    borderTop: '1px solid var(--border-secondary)',
                    fontSize: '0.72rem', color: 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                  }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
                    </svg>
                    {new Date(d.delivered_at).toLocaleString()}
                  </div>
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
    </div>
  );
}
