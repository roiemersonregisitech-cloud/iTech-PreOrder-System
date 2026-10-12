'use client';

import React, { useState, useRef, useEffect } from 'react';

interface DateFilterProps {
  dateFrom: string;
  dateTo: string;
  onChange: (from: string, to: string) => void;
  disabled?: boolean;
}

function toLocalDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateLabel(from: string, to: string): string | null {
  if (!from && !to) return null;
  const parse = (s: string) => {
    const parts = s.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  };
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const fmtShort = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (from && to) {
    if (from === to) return fmt(parse(from));
    const d1 = parse(from);
    const d2 = parse(to);
    if (d1.getFullYear() === d2.getFullYear()) {
      return `${fmtShort(d1)} – ${fmt(d2)}`;
    }
    return `${fmt(d1)} – ${fmt(d2)}`;
  }
  if (from) return `From ${fmt(parse(from))}`;
  if (to) return `To ${fmt(parse(to))}`;
  return null;
}

function formatShortMobileLabel(from: string, to: string): string | null {
  if (!from && !to) return null;
  const parse = (s: string) => {
    const parts = s.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  };
  const fmtShort = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (from && to) {
    if (from === to) return fmtShort(parse(from));
    return `${fmtShort(parse(from))}–${fmtShort(parse(to))}`;
  }
  if (from) return `From ${fmtShort(parse(from))}`;
  if (to) return `To ${fmtShort(parse(to))}`;
  return null;
}

export function DateFilter({ dateFrom, dateTo, onChange, disabled = false }: DateFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'single' | 'range'>(dateFrom && dateTo && dateFrom === dateTo ? 'single' : 'range');
  const [tempFrom, setTempFrom] = useState(dateFrom);
  const [tempTo, setTempTo] = useState(dateTo);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Detect mobile viewport
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync temp values when props change or popover opens
  useEffect(() => {
    setTempFrom(dateFrom);
    setTempTo(dateTo);
    if (dateFrom && dateTo && dateFrom === dateTo) {
      setMode('single');
    }
  }, [dateFrom, dateTo, isOpen]);

  // Click outside listener for desktop popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!isMobile && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, isMobile]);

  // Lock body scroll on mobile bottom-sheet
  useEffect(() => {
    if (isOpen && isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, isMobile]);

  const activeLabel = formatDateLabel(dateFrom, dateTo);
  const activeShortLabel = formatShortMobileLabel(dateFrom, dateTo);
  const isFiltered = Boolean(dateFrom || dateTo);

  const applyPreset = (preset: 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth') => {
    const now = new Date();
    let from = '';
    let to = '';

    switch (preset) {
      case 'today': {
        const todayStr = toLocalDateStr(now);
        from = todayStr;
        to = todayStr;
        break;
      }
      case 'yesterday': {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        const yStr = toLocalDateStr(y);
        from = yStr;
        to = yStr;
        break;
      }
      case 'last7': {
        const past = new Date();
        past.setDate(past.getDate() - 6);
        from = toLocalDateStr(past);
        to = toLocalDateStr(now);
        break;
      }
      case 'last30': {
        const past = new Date();
        past.setDate(past.getDate() - 29);
        from = toLocalDateStr(past);
        to = toLocalDateStr(now);
        break;
      }
      case 'thisMonth': {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        from = toLocalDateStr(firstDay);
        to = toLocalDateStr(now);
        break;
      }
    }

    setTempFrom(from);
    setTempTo(to);
    onChange(from, to);
    setIsOpen(false);
  };

  const handleApply = () => {
    if (mode === 'single') {
      onChange(tempFrom, tempFrom);
    } else {
      onChange(tempFrom, tempTo);
    }
    setIsOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTempFrom('');
    setTempTo('');
    onChange('', '');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      {/* Trigger Button — Responsive */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-label="Filter by date or date range"
        className="date-filter-trigger-mini"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: isFiltered ? '0.3rem 0.65rem' : '0.3rem 0.6rem',
          borderRadius: '9999px',
          background: isFiltered
            ? 'rgba(99, 102, 241, 0.16)'
            : 'var(--bg-tertiary)',
          border: isFiltered
            ? '1px solid var(--accent-primary)'
            : '1px solid var(--border-primary)',
          color: isFiltered ? 'var(--accent-primary)' : 'var(--text-secondary)',
          fontSize: '0.78rem',
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isFiltered ? '0 0 10px rgba(99, 102, 241, 0.2)' : 'none',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {/* Calendar Icon */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            flexShrink: 0,
            color: isFiltered ? 'var(--accent-primary)' : 'var(--text-muted)'
          }}
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>

        {/* Desktop Full Label */}
        <span className="date-filter-label-desktop">
          {activeLabel || 'All Dates'}
        </span>

        {/* Mobile Mini Label */}
        <span className="date-filter-label-mobile" style={{ fontSize: '0.72rem' }}>
          {activeShortLabel || 'Date'}
        </span>

        {/* Active Dot / Clear button */}
        {isFiltered ? (
          <span
            onClick={handleClear}
            title="Clear date filter"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '15px',
              height: '15px',
              borderRadius: '50%',
              background: 'rgba(99, 102, 241, 0.25)',
              color: 'var(--accent-primary)',
              marginLeft: '0.1rem',
              cursor: 'pointer',
              fontSize: '10px',
              lineHeight: 1,
            }}
          >
            ✕
          </span>
        ) : (
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            style={{ opacity: 0.5, flexShrink: 0 }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>

      {/* POPUP / MODAL CONTENT */}
      {isOpen && (
        <>
          {/* MOBILE VIEW: Bottom Sheet Drawer with Backdrop */}
          {isMobile ? (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                background: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(6px)',
              }}
              onClick={e => {
                if (e.target === e.currentTarget) setIsOpen(false);
              }}
            >
              <div
                ref={popoverRef}
                className="glass-card animate-fade-in"
                style={{
                  width: '100%',
                  maxHeight: '85vh',
                  overflowY: 'auto',
                  borderTopLeftRadius: '20px',
                  borderTopRightRadius: '20px',
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
                  padding: '1.25rem 1rem calc(1.5rem + env(safe-area-inset-bottom, 0px)) 1rem',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-primary)',
                  borderBottom: 'none',
                  boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.6)',
                  animation: 'slideUpSheet 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                {/* Pull Handle */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border-primary)' }} />
                </div>

                {/* Mobile Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2.2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                      Filter by Date
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-secondary)',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Quick Presets for Mobile (1-Tap Experience) */}
                <div style={{ marginBottom: '1.1rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                    Quick Presets
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.45rem' }}>
                    {[
                      { label: 'Today', key: 'today' as const },
                      { label: 'Yesterday', key: 'yesterday' as const },
                      { label: 'Last 7 Days', key: 'last7' as const },
                      { label: 'This Month', key: 'thisMonth' as const },
                    ].map(p => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => applyPreset(p.key)}
                        style={{
                          padding: '0.6rem 0.5rem',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          borderRadius: '8px',
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-secondary)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          textAlign: 'center',
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Date Mode Switcher */}
                <div style={{ marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                      Custom Date
                    </span>
                    <div
                      style={{
                        display: 'flex',
                        background: 'var(--bg-tertiary)',
                        padding: '2px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-secondary)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setMode('single')}
                        style={{
                          padding: '0.25rem 0.6rem',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          borderRadius: '4px',
                          border: 'none',
                          background: mode === 'single' ? 'var(--accent-primary)' : 'transparent',
                          color: mode === 'single' ? '#fff' : 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}
                      >
                        Single
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode('range')}
                        style={{
                          padding: '0.25rem 0.6rem',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          borderRadius: '4px',
                          border: 'none',
                          background: mode === 'range' ? 'var(--accent-primary)' : 'transparent',
                          color: mode === 'range' ? '#fff' : 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}
                      >
                        Range
                      </button>
                    </div>
                  </div>

                  {mode === 'single' ? (
                    <div>
                      <input
                        id="mobile-single-date-picker"
                        type="date"
                        value={tempFrom}
                        onChange={e => {
                          setTempFrom(e.target.value);
                          setTempTo(e.target.value);
                        }}
                        style={{
                          width: '100%',
                          padding: '0.65rem 0.75rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border-primary)',
                          background: 'var(--bg-input, var(--bg-tertiary))',
                          color: 'var(--text-primary)',
                          fontSize: '0.9rem',
                          outline: 'none',
                          minHeight: '44px',
                        }}
                      />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div>
                        <label htmlFor="mobile-range-date-from" style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                          From Date
                        </label>
                        <input
                          id="mobile-range-date-from"
                          type="date"
                          value={tempFrom}
                          onChange={e => setTempFrom(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.65rem 0.75rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border-primary)',
                            background: 'var(--bg-input, var(--bg-tertiary))',
                            color: 'var(--text-primary)',
                            fontSize: '0.9rem',
                            outline: 'none',
                            minHeight: '44px',
                          }}
                        />
                      </div>
                      <div>
                        <label htmlFor="mobile-range-date-to" style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                          To Date
                        </label>
                        <input
                          id="mobile-range-date-to"
                          type="date"
                          value={tempTo}
                          onChange={e => setTempTo(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.65rem 0.75rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border-primary)',
                            background: 'var(--bg-input, var(--bg-tertiary))',
                            color: 'var(--text-primary)',
                            fontSize: '0.9rem',
                            outline: 'none',
                            minHeight: '44px',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Mobile Actions */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
                  <button
                    type="button"
                    onClick={() => handleClear()}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-secondary)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      minHeight: '44px',
                    }}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={handleApply}
                    style={{
                      flex: 2,
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: 'var(--accent-primary)',
                      border: 'none',
                      color: '#fff',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      minHeight: '44px',
                      boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
                    }}
                  >
                    Apply Filter
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* DESKTOP VIEW: Standard Dropdown Popover */
            <div
              className="glass-card animate-fade-in"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                zIndex: 60,
                width: '320px',
                padding: '1rem',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4), 0 0 1px rgba(255, 255, 255, 0.1)',
                background: 'var(--bg-secondary)',
                backdropFilter: 'blur(16px)',
                borderRadius: 'var(--radius-lg, 12px)',
                border: '1px solid var(--border-primary)',
              }}
            >
              {/* Header & Mode Switcher */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                  Filter by Date
                </span>
                <div
                  style={{
                    display: 'flex',
                    background: 'var(--bg-tertiary)',
                    padding: '2px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-secondary)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setMode('single')}
                    style={{
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      borderRadius: '4px',
                      border: 'none',
                      background: mode === 'single' ? 'var(--accent-primary)' : 'transparent',
                      color: mode === 'single' ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    Single Date
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('range')}
                    style={{
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      borderRadius: '4px',
                      border: 'none',
                      background: mode === 'range' ? 'var(--accent-primary)' : 'transparent',
                      color: mode === 'range' ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    Date Range
                  </button>
                </div>
              </div>

              {/* Quick Presets */}
              <div style={{ marginBottom: '0.9rem' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                  Quick Presets
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {[
                    { label: 'Today', key: 'today' as const },
                    { label: 'Yesterday', key: 'yesterday' as const },
                    { label: 'Last 7 Days', key: 'last7' as const },
                    { label: 'Last 30 Days', key: 'last30' as const },
                    { label: 'This Month', key: 'thisMonth' as const },
                  ].map(p => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => applyPreset(p.key)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.72rem',
                        fontWeight: 500,
                        borderRadius: '6px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-secondary)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'var(--accent-primary)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--border-secondary)';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Inputs Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
                {mode === 'single' ? (
                  <div>
                    <label
                      htmlFor="single-date-picker"
                      style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}
                    >
                      Specific Date
                    </label>
                    <input
                      id="single-date-picker"
                      type="date"
                      value={tempFrom}
                      onChange={e => {
                        setTempFrom(e.target.value);
                        setTempTo(e.target.value);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.65rem',
                        borderRadius: 'var(--radius-sm, 6px)',
                        border: '1px solid var(--border-primary)',
                        background: 'var(--bg-input, var(--bg-tertiary))',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                        outline: 'none',
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label
                        htmlFor="range-date-from"
                        style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}
                      >
                        From
                      </label>
                      <input
                        id="range-date-from"
                        type="date"
                        value={tempFrom}
                        onChange={e => setTempFrom(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.45rem 0.65rem',
                          borderRadius: 'var(--radius-sm, 6px)',
                          border: '1px solid var(--border-primary)',
                          background: 'var(--bg-input, var(--bg-tertiary))',
                          color: 'var(--text-primary)',
                          fontSize: '0.8rem',
                          outline: 'none',
                        }}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="range-date-to"
                        style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}
                      >
                        To
                      </label>
                      <input
                        id="range-date-to"
                        type="date"
                        value={tempTo}
                        onChange={e => setTempTo(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.45rem 0.65rem',
                          borderRadius: 'var(--radius-sm, 6px)',
                          border: '1px solid var(--border-primary)',
                          background: 'var(--bg-input, var(--bg-tertiary))',
                          color: 'var(--text-primary)',
                          fontSize: '0.8rem',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Desktop Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.6rem', borderTop: '1px solid var(--border-secondary)' }}>
                <button
                  type="button"
                  onClick={() => handleClear()}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '0.3rem 0.5rem',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-danger)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  Reset
                </button>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: 'var(--radius-sm, 6px)',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-secondary)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApply}
                    style={{
                      padding: '0.35rem 0.85rem',
                      borderRadius: 'var(--radius-sm, 6px)',
                      background: 'var(--accent-primary)',
                      border: 'none',
                      color: '#fff',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)',
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
