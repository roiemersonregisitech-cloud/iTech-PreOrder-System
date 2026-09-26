'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Spinner, ActionButton } from '@/components/ui';
import type { Branch } from '@/lib/types';

interface BranchOverride {
  branch_id: string;
  timeout_minutes: number | null;
  branch?: { id: string; code: string; name: string };
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [globalTimeout, setGlobalTimeout] = useState(30);
  const [invoiceLength, setInvoiceLength] = useState(6);
  const [backorderEnabled, setBackorderEnabled] = useState(false);
  const [overrides, setOverrides] = useState<BranchOverride[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [saved, setSaved] = useState(false);

  // Add override form
  const [addBranch, setAddBranch] = useState('');
  const [addTimeout, setAddTimeout] = useState('');

  const fetchSettings = useCallback(async () => {
    const [timeoutRes, invoiceRes, backorderRes] = await Promise.all([
      fetch('/api/settings/reservation-timeout'),
      fetch('/api/settings/invoice-format'),
      fetch('/api/settings/backorder')
    ]);
    const timeoutData = await timeoutRes.json();
    const invoiceData = await invoiceRes.json();
    const backorderData = await backorderRes.json();
    if (timeoutRes.ok) {
      setGlobalTimeout(timeoutData.global_timeout_minutes);
      setOverrides(timeoutData.branch_overrides || []);
    }
    if (invoiceRes.ok) {
      setInvoiceLength(invoiceData.invoice_length || 6);
    }
    if (backorderRes.ok) {
      setBackorderEnabled(backorderData.backorder_enabled || false);
    }
  }, []);

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
      await Promise.all([fetchSettings(), fetchBranches()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    const [timeoutRes, invoiceRes, backorderRes] = await Promise.all([
      fetch('/api/settings/reservation-timeout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ global_timeout_minutes: globalTimeout }),
      }),
      fetch('/api/settings/invoice-format', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_length: invoiceLength }),
      }),
      fetch('/api/settings/backorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backorder_enabled: backorderEnabled }),
      })
    ]);
    if (timeoutRes.ok && invoiceRes.ok && backorderRes.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  async function handleAddOverride() {
    if (!addBranch || !addTimeout) return;
    const res = await fetch('/api/settings/reservation-timeout', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch_overrides: [{ branch_id: addBranch, timeout_minutes: parseInt(addTimeout) }],
      }),
    });
    if (res.ok) {
      setAddBranch(''); setAddTimeout('');
      fetchSettings();
    }
  }

  async function handleRemoveOverride(branchId: string) {
    const res = await fetch('/api/settings/reservation-timeout', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch_overrides: [{ branch_id: branchId, timeout_minutes: null }],
      }),
    });
    if (res.ok) fetchSettings();
  }

  if (loading) return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)' }}>Settings</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading configuration…</p>
      </div>
      <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ width: '200px', height: '1rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', marginBottom: '1rem' }} />
        <div style={{ width: '100%', maxWidth: '320px', height: '38px', borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)', marginBottom: '0.75rem' }} />
        <div style={{ width: '140px', height: '36px', borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)' }} />
      </div>
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <div style={{ width: '240px', height: '1rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', marginBottom: '1rem' }} />
        {[1, 2].map(i => (
          <div key={i} style={{ width: '100%', height: '48px', borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)', marginBottom: '0.5rem' }} />
        ))}
      </div>
    </div>
  );

  const inputStyle: React.CSSProperties = {
    padding: '0.6rem 0.8rem', background: 'var(--bg-input)',
    border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none',
  };

  const overrideBranchIds = overrides.map(o => o.branch_id);
  const availableBranches = branches.filter(b => !overrideBranchIds.includes(b.id));

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)' }}>Settings</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>System configuration</p>
        </div>
      </div>

      {/* Global Timeout */}
      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '0.25rem' }}>
          Reservation Timeout
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          How long a reservation stays pending before auto-expiring. Changes apply to new reservations only.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            Global Default:
          </label>
          <input
            id="global-timeout"
            type="number"
            min={1}
            max={1440}
            value={globalTimeout}
            onChange={e => setGlobalTimeout(parseInt(e.target.value) || 30)}
            style={{ ...inputStyle, width: '100px' }}
          />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>minutes</span>
          <ActionButton
            id="save-global-timeout"
            label={saved ? '✓ Saved' : 'Save'}
            loadingLabel="Saving…"
            variant="primary"
            onClick={handleSave}
          />
        </div>
      </div>

      {/* Invoice Settings */}
      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '0.25rem' }}>
          Invoice Number Format
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Set the required number of digits for the invoice number when confirming downpayments and marking deliveries. Only numeric characters are allowed.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            Required Digits:
          </label>
          <input
            id="invoice-length"
            type="number"
            min={4}
            max={20}
            value={invoiceLength}
            onChange={e => setInvoiceLength(parseInt(e.target.value) || 6)}
            style={{ ...inputStyle, width: '100px' }}
          />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>digits</span>
          <ActionButton
            id="save-invoice-format"
            label={saved ? '✓ Saved' : 'Save All Settings'}
            loadingLabel="Saving…"
            variant="primary"
            onClick={handleSave}
          />
        </div>
      </div>

      {/* Backorder Settings */}
      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '0.25rem' }}>
          Backorder Settings
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          When enabled, products individually marked as &quot;backorder allowed&quot; can be reserved even when stock is 0. Cashiers will be warned that the item is a backorder.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            Allow Backorders:
          </label>
          <button
            id="backorder-toggle"
            type="button"
            onClick={() => setBackorderEnabled(!backorderEnabled)}
            style={{
              position: 'relative', width: '48px', height: '26px', borderRadius: '9999px',
              border: 'none', cursor: 'pointer', transition: 'background 0.3s',
              background: backorderEnabled ? 'var(--accent-success)' : 'var(--bg-tertiary)',
            }}
          >
            <span style={{
              position: 'absolute', top: '3px', width: '20px', height: '20px', borderRadius: '50%',
              background: 'white', transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              left: backorderEnabled ? '25px' : '3px',
            }} />
          </button>
          <span style={{
            fontSize: '0.8rem', fontWeight: 700,
            color: backorderEnabled ? 'var(--accent-success)' : 'var(--text-muted)',
          }}>
            {backorderEnabled ? 'ENABLED' : 'DISABLED'}
          </span>
          <ActionButton
            id="save-backorder"
            label={saved ? '✓ Saved' : 'Save All Settings'}
            loadingLabel="Saving…"
            variant="primary"
            onClick={handleSave}
          />
        </div>

        {backorderEnabled && (
          <div style={{
            padding: '0.75rem', borderRadius: 'var(--radius-md)',
            background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)',
            fontSize: '0.8rem', color: 'var(--accent-warning)',
          }}>
            ⚠️ Backorders are enabled. Go to the <strong>Products</strong> page to mark individual products as backorder-eligible.
          </div>
        )}
      </div>

      {/* Branch Overrides */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '0.25rem' }}>
          Per-Branch Overrides
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Set different timeouts for specific branches. These override the global default.
        </p>

        {overrides.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            {overrides.map(o => (
              <div key={o.branch_id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-tertiary)', marginBottom: '0.4rem',
              }}>
                <div style={{ fontSize: '0.85rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>
                    {o.branch?.name || o.branch_id}
                  </span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                    ({o.branch?.code})
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--accent-warning)' }}>
                    {typeof o.timeout_minutes === 'number' ? o.timeout_minutes : Number(o.timeout_minutes)} min
                  </span>
                  <button
                    onClick={() => handleRemoveOverride(o.branch_id)}
                    style={{
                      padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)',
                      background: 'var(--accent-danger-bg)', border: 'none',
                      color: 'var(--accent-danger)', fontSize: '0.7rem', cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {availableBranches.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select
              id="override-branch"
              value={addBranch}
              onChange={e => setAddBranch(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            >
              <option value="">Select branch</option>
              {availableBranches.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
            <input
              id="override-timeout"
              type="number"
              min={1}
              max={1440}
              value={addTimeout}
              onChange={e => setAddTimeout(e.target.value)}
              placeholder="Minutes"
              style={{ ...inputStyle, width: '100px' }}
            />
            <ActionButton
              id="add-override"
              label="Add"
              loadingLabel="Adding…"
              variant="secondary"
              disabled={!addBranch || !addTimeout}
              onClick={handleAddOverride}
            />
          </div>
        )}
      </div>
    </div>
  );
}
