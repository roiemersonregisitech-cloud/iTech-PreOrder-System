'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Spinner, Modal, ActionButton, Pagination, SkeletonTable } from '@/components/ui';
import type { Staff, Branch } from '@/lib/types';

interface ImportResult {
  row: number;
  email: string;
  full_name: string;
  status: 'success' | 'error';
  error?: string;
}

interface ImportSummary {
  total: number;
  success: number;
  errors: number;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  });
}

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
  const [branchSearchText, setBranchSearchText] = useState('');
  const [createError, setCreateError] = useState('');

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importParsedRows, setImportParsedRows] = useState<Record<string, string>[]>([]);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setBranchSearchText('');
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setImportError('');
    setImportResults(null);
    setImportSummary(null);

    if (!file) {
      setImportFile(null);
      setImportParsedRows([]);
      return;
    }
    if (!file.name.endsWith('.csv')) {
      setImportError('Please select a .csv file');
      setImportFile(null);
      setImportParsedRows([]);
      return;
    }

    setImportFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length === 0) {
        setImportError('CSV file is empty or has no data rows');
        setImportParsedRows([]);
        return;
      }
      // Validate required columns
      const requiredCols = ['full_name', 'email', 'password', 'role', 'branch_code'];
      const headers = Object.keys(rows[0]);
      const missing = requiredCols.filter(c => !headers.includes(c));
      if (missing.length > 0) {
        setImportError(`Missing required columns: ${missing.join(', ')}`);
        setImportParsedRows([]);
        return;
      }
      if (rows.length > 100) {
        setImportError('Maximum 100 rows per import. Please split your file.');
        setImportParsedRows([]);
        return;
      }
      setImportParsedRows(rows);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (importParsedRows.length === 0) return;
    setImporting(true);
    setImportError('');
    setImportResults(null);
    setImportSummary(null);

    try {
      const res = await fetch('/api/staff/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: importParsedRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error || 'Import failed');
      } else {
        setImportSummary(data.summary);
        setImportResults(data.results);
        fetchStaff();
      }
    } catch {
      setImportError('Network error during import');
    } finally {
      setImporting(false);
    }
  }

  function resetImportModal() {
    setShowImport(false);
    setImportFile(null);
    setImportParsedRows([]);
    setImportError('');
    setImportResults(null);
    setImportSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleDownloadTemplate() {
    const res = await fetch('/api/staff/template');
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'staff_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Import & Template — super_admin only */}
          {currentStaff?.role === 'super_admin' && (
            <>
              <button
                id="download-template-btn"
                onClick={handleDownloadTemplate}
                disabled={loading}
                style={{
                  padding: '0.625rem 1rem', borderRadius: 'var(--radius-md)',
                  background: 'transparent', color: 'var(--accent-primary)',
                  border: '1px solid var(--accent-primary)',
                  fontSize: '0.8rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  opacity: loading ? 0.7 : 1, transition: 'all 0.2s ease',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Template
              </button>
              <button
                id="import-staff-btn"
                onClick={() => setShowImport(true)}
                disabled={loading}
                style={{
                  padding: '0.625rem 1rem', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                  border: '1px solid var(--border-primary)',
                  fontSize: '0.8rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  opacity: loading ? 0.7 : 1, transition: 'all 0.2s ease',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Import CSV
              </button>
            </>
          )}
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

      {/* Create Staff Modal */}
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
                <>
                  <input
                    list="staff-branches-list"
                    id="staff-branch"
                    value={branchSearchText}
                    onChange={e => {
                      setBranchSearchText(e.target.value);
                      const match = branches.find(b => `${b.name} (${b.code})` === e.target.value);
                      if (match) setNewBranch(match.id);
                      else setNewBranch('');
                    }}
                    placeholder="Type to search branch..."
                    style={inputStyle}
                  />
                  <datalist id="staff-branches-list">
                    {branches.map(b => <option key={b.id} value={`${b.name} (${b.code})`} />)}
                  </datalist>
                </>
              )}
            </div>
          </div>
          {createError && <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', background: 'var(--accent-danger-bg)', color: 'var(--accent-danger)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{createError}</div>}
          <ActionButton id="submit-staff" label="Create Account" loadingLabel="Creating…" variant="primary" onClick={handleCreate}
            disabled={!newName || !newEmail || !newPassword || !newBranch}
            style={{ width: '100%', justifyContent: 'center', padding: '0.7rem' }} />
        </div>
      </Modal>

      {/* Import Staff Modal — super_admin only */}
      <Modal isOpen={showImport} onClose={resetImportModal} title="Bulk Import Staff">
        <div>
          {/* Instructions */}
          <div style={{
            padding: '0.75rem', marginBottom: '1rem', borderRadius: 'var(--radius-md)',
            background: 'var(--bg-tertiary)', border: '1px solid var(--border-secondary)',
            fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
              📋 CSV Format Requirements
            </div>
            <div>Required columns: <code style={{ background: 'var(--bg-input)', padding: '0.1rem 0.3rem', borderRadius: '3px', fontSize: '0.75rem' }}>full_name, email, password, role, branch_code</code></div>
            <div style={{ marginTop: '0.25rem' }}>Valid roles: <code style={{ background: 'var(--bg-input)', padding: '0.1rem 0.3rem', borderRadius: '3px', fontSize: '0.75rem' }}>cashier, branch_admin, super_admin</code></div>
            <div style={{ marginTop: '0.25rem' }}>Max 100 rows per import.</div>
            <button
              onClick={handleDownloadTemplate}
              style={{
                marginTop: '0.5rem', padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-sm)',
                background: 'transparent', border: '1px solid var(--accent-primary)',
                color: 'var(--accent-primary)', fontSize: '0.75rem', fontWeight: 600,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download Template
            </button>
          </div>

          {/* File Input */}
          {!importResults && (
            <>
              <label style={labelStyle}>Select CSV File</label>
              <input
                ref={fileInputRef}
                id="import-file-input"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                style={{
                  width: '100%', padding: '0.6rem', marginBottom: '0.75rem',
                  background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              />
            </>
          )}

          {/* Preview */}
          {importParsedRows.length > 0 && !importResults && (
            <div style={{
              marginBottom: '1rem', padding: '0.6rem', borderRadius: 'var(--radius-md)',
              background: 'var(--accent-info-bg)', color: 'var(--accent-info)',
              fontSize: '0.8rem', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              {importParsedRows.length} staff {importParsedRows.length === 1 ? 'account' : 'accounts'} ready to import
            </div>
          )}

          {/* Preview table */}
          {importParsedRows.length > 0 && !importResults && (
            <div style={{ marginBottom: '1rem', maxHeight: '200px', overflowY: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-secondary)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)', position: 'sticky', top: 0 }}>
                    {['#', 'Name', 'Email', 'Role', 'Branch'].map(h => (
                      <th key={h} style={{ padding: '0.4rem 0.5rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importParsedRows.slice(0, 10).map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border-secondary)' }}>
                      <td style={{ padding: '0.35rem 0.5rem', color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td style={{ padding: '0.35rem 0.5rem', color: 'var(--text-heading)', fontWeight: 600 }}>{r.full_name}</td>
                      <td style={{ padding: '0.35rem 0.5rem', color: 'var(--text-secondary)' }}>{r.email}</td>
                      <td style={{ padding: '0.35rem 0.5rem' }}>{roleBadge(r.role || '')}</td>
                      <td style={{ padding: '0.35rem 0.5rem', color: 'var(--text-muted)' }}>{r.branch_code}</td>
                    </tr>
                  ))}
                  {importParsedRows.length > 10 && (
                    <tr><td colSpan={5} style={{ padding: '0.35rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.7rem', fontStyle: 'italic' }}>… and {importParsedRows.length - 10} more</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Error */}
          {importError && (
            <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', background: 'var(--accent-danger-bg)', color: 'var(--accent-danger)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
              {importError}
            </div>
          )}

          {/* Import Results */}
          {importResults && importSummary && (
            <div>
              {/* Summary Banner */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1rem',
              }}>
                <div style={{
                  padding: '0.6rem', borderRadius: 'var(--radius-md)', textAlign: 'center',
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border-secondary)',
                }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-heading)' }}>{importSummary.total}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total</div>
                </div>
                <div style={{
                  padding: '0.6rem', borderRadius: 'var(--radius-md)', textAlign: 'center',
                  background: 'var(--accent-success-bg)', border: '1px solid var(--accent-success)',
                }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-success)' }}>{importSummary.success}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--accent-success)', fontWeight: 600, textTransform: 'uppercase' }}>Success</div>
                </div>
                <div style={{
                  padding: '0.6rem', borderRadius: 'var(--radius-md)', textAlign: 'center',
                  background: importSummary.errors > 0 ? 'var(--accent-danger-bg)' : 'var(--bg-tertiary)',
                  border: `1px solid ${importSummary.errors > 0 ? 'var(--accent-danger)' : 'var(--border-secondary)'}`,
                }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: importSummary.errors > 0 ? 'var(--accent-danger)' : 'var(--text-muted)' }}>{importSummary.errors}</div>
                  <div style={{ fontSize: '0.7rem', color: importSummary.errors > 0 ? 'var(--accent-danger)' : 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Errors</div>
                </div>
              </div>

              {/* Results Table */}
              <div style={{ maxHeight: '250px', overflowY: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-secondary)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-tertiary)', position: 'sticky', top: 0 }}>
                      {['Row', 'Name', 'Email', 'Status', 'Details'].map(h => (
                        <th key={h} style={{ padding: '0.4rem 0.5rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importResults.map((r, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border-secondary)' }}>
                        <td style={{ padding: '0.35rem 0.5rem', color: 'var(--text-muted)' }}>{r.row}</td>
                        <td style={{ padding: '0.35rem 0.5rem', color: 'var(--text-heading)', fontWeight: 600 }}>{r.full_name}</td>
                        <td style={{ padding: '0.35rem 0.5rem', color: 'var(--text-secondary)' }}>{r.email}</td>
                        <td style={{ padding: '0.35rem 0.5rem' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                            color: r.status === 'success' ? 'var(--accent-success)' : 'var(--accent-danger)',
                            fontWeight: 600,
                          }}>
                            {r.status === 'success' ? '✓' : '✗'} {r.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.35rem 0.5rem', color: 'var(--accent-danger)', fontSize: '0.7rem' }}>{r.error || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Done button */}
              <button
                onClick={resetImportModal}
                style={{
                  width: '100%', marginTop: '1rem', padding: '0.7rem',
                  borderRadius: 'var(--radius-md)', background: 'var(--gradient-primary)',
                  color: 'white', border: 'none', fontSize: '0.85rem', fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          )}

          {/* Import Button */}
          {!importResults && (
            <ActionButton
              id="submit-import"
              label={`Import ${importParsedRows.length} Staff`}
              loadingLabel="Importing…"
              variant="primary"
              onClick={handleImport}
              disabled={importParsedRows.length === 0 || importing}
              style={{ width: '100%', justifyContent: 'center', padding: '0.7rem' }}
            />
          )}
        </div>
      </Modal>
    </div>
  );
}
