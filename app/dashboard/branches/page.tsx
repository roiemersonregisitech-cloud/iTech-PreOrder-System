'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Spinner, Modal, ActionButton, Pagination, SkeletonCard } from '@/components/ui';
import type { Branch } from '@/lib/types';

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState('');

  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchBranches = useCallback(async () => {
    const res = await fetch('/api/branches');
    const data = await res.json();
    if (res.ok) setBranches(data.data || []);
  }, []);

  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    (async () => {
      await fetchBranches();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate() {
    setCreateError('');
    const res = await fetch('/api/branches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: newCode, name: newName }),
    });
    const data = await res.json();
    if (!res.ok) { setCreateError(data.error); return; }
    setShowCreate(false); setNewCode(''); setNewName('');
    fetchBranches();
  }

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)' }}>Branches</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading store locations…</p>
        </div>
        <SkeletonCard count={4} />
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.6rem 0.8rem',
    background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    fontSize: '0.85rem', outline: 'none', marginBottom: '0.75rem',
  };

  const totalPages = Math.ceil(branches.length / pageSize);
  const paginatedBranches = branches.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)' }}>Branches</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Manage retail branch locations</p>
        </div>
        <button id="create-branch-btn" onClick={() => setShowCreate(true)} style={{
          padding: '0.625rem 1.25rem', borderRadius: 'var(--radius-md)',
          background: 'var(--gradient-primary)', color: 'white', border: 'none',
          fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Branch
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {paginatedBranches.map((b, i) => (
          <div key={b.id} className="glass-card" style={{ padding: '1.25rem', animation: `fadeIn ${150 + i * 50}ms ease-out` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1rem', color: 'var(--accent-primary)', letterSpacing: '0.05em' }}>
                {b.code}
              </span>
              <span className={`badge ${b.is_active ? 'badge-confirmed' : 'badge-cancelled'}`}>
                {b.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-heading)' }}>{b.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Created {new Date(b.created_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={branches.length}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[5, 10, 20, 50]}
      />

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Branch">
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Branch Code</label>
          <input id="branch-code" value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())} placeholder="e.g. ASUSAYAL" style={inputStyle} maxLength={20} />
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Branch Name</label>
          <input id="branch-name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Asus Ayala Branch" style={inputStyle} />
          {createError && <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', background: 'var(--accent-danger-bg)', color: 'var(--accent-danger)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{createError}</div>}
          <ActionButton id="submit-branch" label="Create Branch" loadingLabel="Creating…" variant="primary" onClick={handleCreate}
            disabled={!newCode || !newName} style={{ width: '100%', justifyContent: 'center', padding: '0.7rem' }} />
        </div>
      </Modal>
    </div>
  );
}
