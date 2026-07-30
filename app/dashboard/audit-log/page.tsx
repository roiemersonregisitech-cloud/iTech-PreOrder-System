'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Spinner, Pagination, SkeletonTable } from '@/components/ui';
import type { AuditLog, Staff } from '@/lib/types';

const ACTION_OPTIONS = [
  '', 'auth.login', 'auth.logout', 'reservation.create', 'reservation.cancel',
  'reservation.auto_expire', 'preorder.confirm', 'inventory.adjust',
  'settings.update', 'staff.create', 'staff.deactivate',
];

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchLogs = useCallback(async () => {
    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('limit', pageSize.toString());
    if (actionFilter) params.set('action', actionFilter);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    const res = await fetch(`/api/audit-logs?${params}`);
    const data = await res.json();
    if (res.ok) {
      setLogs(data.data || []);
      setTotal(data.pagination?.total || 0);
    }
  }, [page, pageSize, actionFilter, dateFrom, dateTo]);

  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    (async () => {
      await fetchLogs();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialized.current) return;
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / pageSize);

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)' }}>Audit Log</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading system activity trail…</p>
        </div>
        <SkeletonTable rows={8} columns={4} />
      </div>
    );
  }

  const actionColor = (action: string): string => {
    if (action.includes('create') || action.includes('confirm') || action.includes('login')) return 'var(--accent-success)';
    if (action.includes('cancel') || action.includes('deactivate') || action.includes('expire')) return 'var(--accent-danger)';
    if (action.includes('update') || action.includes('adjust')) return 'var(--accent-warning)';
    return 'var(--accent-info)';
  };

  const selectStyle: React.CSSProperties = {
    padding: '0.5rem 0.7rem', background: 'var(--bg-input)',
    border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none',
  };

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)' }}>Audit Log</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Activity history and security events</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select id="audit-action-filter" value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }} style={selectStyle}>
          <option value="">All Actions</option>
          {ACTION_OPTIONS.filter(Boolean).map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <input id="audit-date-from" type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} style={selectStyle} />
        <input id="audit-date-to" type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} style={selectStyle} />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{total} entries</span>
      </div>

      {/* Log Entries */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                {['Time', 'User', 'Action', 'Entity', 'IP', 'Device', 'Browser'].map(h => (
                  <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No audit logs found</td></tr>
              ) : logs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                  <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: 500 }}>
                    {(log.user as Staff)?.full_name || 'System'}
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>
                    <span style={{ color: actionColor(log.action), fontWeight: 600, fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                    {log.entity_type && `${log.entity_type}:${log.entity_id?.slice(0, 8)}…`}
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                    {log.ip_address || '—'}
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                    {log.device_type || '—'}
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                    {log.browser || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 20, 30, 50, 100]}
        />
      </div>
    </div>
  );
}
