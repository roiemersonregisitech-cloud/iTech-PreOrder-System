'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Spinner, Modal, ActionButton, Pagination, SkeletonTable } from '@/components/ui';
import type { Staff, Branch } from '@/lib/types';

export default function StaffPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentStaff, setCurrentStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [updatingStaffId, setUpdatingStaffId] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Create form
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('cashier');
  const [newBranch, setNewBranch] = useState('');
  const [createError, setCreateError] = useState('');

  const fetchStaff = useCallback(async () => {
    const res = await fetch('/api/staff');
    const data = await res.json();
    if (res.ok) setStaffList(data.data || []);
  }, []);

  const fetchBranches = useCallback(async () => {
    const res = await fetch('/api/branches');
    const data = await res.json();
    if (res.ok) setBranches(data.data || []);
  }, []);

  const fetchCurrentStaff = useCallback(async () => {
    const res = await fetch('/api/staff/me');
    if (res.ok) {
      const data = await res.json();
      setCurrentStaff(data.staff);
      if (data.staff.role === 'branch_admin') {
        setNewRole('cashier');
        setNewBranch(data.staff.branch_id);
      }
    }
  }, []);

  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    (async () => {
      await Promise.all([fetchStaff(), fetchBranches(), fetchCurrentStaff()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate() {
    setCreateError('');
    const res = await fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: newEmail, password: newPassword,
        full_name: newName, role: newRole, branch_id: newBranch,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setCreateError(data.error); return; }
    setShowCreate(false);
    setNewEmail(''); setNewPassword(''); setNewName('');
    if (currentStaff?.role !== 'branch_admin') {
      setNewRole('cashier');
      setNewBranch('');
    }
    fetchStaff();
  }

  async function toggleActive(staff: Staff) {
    setUpdatingStaffId(staff.id);
    await fetch(`/api/staff/${staff.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !staff.is_active }),
    });
    await fetchStaff();
    setUpdatingStaffId(null);
  }

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = { cashier: 'var(--accent-info)', branch_admin: 'var(--accent-warning)', super_admin: 'var(--accent-danger)' };
    return <span style={{ color: colors[role] || 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>{role.replace('_', ' ')}</span>;
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.6rem 0.8rem',
    background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    fontSize: '0.85rem', outline: 'none', marginBottom: '0.75rem',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.8rem', fontWeight: 600,
    color: 'var(--text-secondary)', marginBottom: '0.3rem',
  };

  const totalPages = Math.ceil(staffList.length / pageSize);
  const paginatedStaff = staffList.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)' }}>Staff</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Manage user accounts</p>
        </div>
        <button id="create-staff-btn" onClick={() => setShowCreate(true)} disabled={loading} style={{
          padding: '0.625rem 1.25rem', borderRadius: 'var(--radius-md)',
          background: 'var(--gradient-primary)', color: 'white', border: 'none',
          fontSize: '0.85rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          opacity: loading ? 0.7 : 1
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Staff
        </button>
      </div>

      {loading ? (
        <SkeletonTable rows={5} columns={5} />
      ) : (
      <div className="glass-card responsive-table-wrapper" style={{ overflow: 'hidden', padding: '1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
              {['Name', 'Role', 'Branch', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedStaff.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid var(--border-secondary)', opacity: s.is_active ? 1 : 0.5 }}>
                <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-heading)' }}>{s.full_name}</td>
                <td style={{ padding: '0.75rem 1rem' }}>{roleBadge(s.role)}</td>
                <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{(s.branch as Branch)?.name || 'All Branches'}</td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <span className={`badge ${s.is_active ? 'badge-confirmed' : 'badge-cancelled'}`}>{s.is_active ? 'Active' : 'Inactive'}</span>
                </td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  {(currentStaff?.role === 'super_admin' || (currentStaff?.role === 'branch_admin' && s.role === 'cashier')) && (
                    <button id={`toggle-staff-${s.id}`} disabled={updatingStaffId === s.id} onClick={() => toggleActive(s)} style={{
                      padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-sm)',
                      background: s.is_active ? 'var(--accent-danger-bg)' : 'var(--accent-success-bg)',
                      border: 'none', color: s.is_active ? 'var(--accent-danger)' : 'var(--accent-success)',
                      fontSize: '0.75rem', cursor: updatingStaffId === s.id ? 'not-allowed' : 'pointer', fontWeight: 600,
                      opacity: updatingStaffId === s.id ? 0.7 : 1,
                    }}>
                      {updatingStaffId === s.id ? <Spinner size={14} /> : (s.is_active ? 'Deactivate' : 'Activate')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={staffList.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[5, 10, 20, 50]}
        />
      </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Staff Account">
        <div>
          <label style={labelStyle}>Full Name</label>
          <input id="staff-name" value={newName} onChange={e => setNewName(e.target.value)} style={inputStyle} placeholder="John Doe" />
          <label style={labelStyle}>Email</label>
          <input id="staff-email" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} style={inputStyle} placeholder="john@company.com" />
          <label style={labelStyle}>Password</label>
          <input id="staff-password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={inputStyle} placeholder="Minimum 6 characters" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Role</label>
              {currentStaff?.role === 'branch_admin' ? (
                <div style={{...inputStyle, background: 'var(--bg-tertiary)', opacity: 0.7}}>Cashier</div>
              ) : (
                <select id="staff-role" value={newRole} onChange={e => setNewRole(e.target.value)} style={inputStyle}>
                  <option value="cashier">Cashier</option>
                  <option value="branch_admin">Branch Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              )}
            </div>
            <div>
              <label style={labelStyle}>Branch</label>
              {currentStaff?.role === 'branch_admin' ? (
                <div style={{...inputStyle, background: 'var(--bg-tertiary)', opacity: 0.7}}>
                  {branches.find(b => b.id === currentStaff.branch_id)?.name || 'Your Branch'}
                </div>
              ) : (
                <select id="staff-branch" value={newBranch} onChange={e => setNewBranch(e.target.value)} style={inputStyle}>
                  <option value="">Select branch</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                </select>
              )}
            </div>
          </div>
          {createError && <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', background: 'var(--accent-danger-bg)', color: 'var(--accent-danger)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{createError}</div>}
          <ActionButton id="submit-staff" label="Create Account" loadingLabel="Creating…" variant="primary" onClick={handleCreate}
            disabled={!newName || !newEmail || !newPassword || !newBranch}
            style={{ width: '100%', justifyContent: 'center', padding: '0.7rem' }} />
        </div>
      </Modal>
    </div>
  );
}
