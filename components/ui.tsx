'use client';

import { useState, useEffect, useCallback } from 'react';

interface CountdownProps {
  expiresAt: string;
  onExpired?: () => void;
}

export function Countdown({ expiresAt, onExpired }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);
  const [urgency, setUrgency] = useState<'normal' | 'warning' | 'danger'>('normal');

  useEffect(() => {
    function update() {
      const now = Date.now();
      const expires = new Date(expiresAt).getTime();
      const diff = expires - now;

      if (diff <= 0) {
        setTimeLeft('Expired');
        setIsExpired(true);
        setUrgency('danger');
        onExpired?.();
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      if (minutes < 2) setUrgency('danger');
      else if (minutes < 5) setUrgency('warning');
      else setUrgency('normal');

      setTimeLeft(`${minutes}m ${seconds.toString().padStart(2, '0')}s`);
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  const colors = {
    normal: { color: 'var(--accent-info)', bg: 'var(--accent-info-bg)' },
    warning: { color: 'var(--accent-warning)', bg: 'var(--accent-warning-bg)' },
    danger: { color: 'var(--accent-danger)', bg: 'var(--accent-danger-bg)' },
  };

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
      padding: '0.2rem 0.6rem', borderRadius: '9999px',
      background: colors[urgency].bg,
      color: colors[urgency].color,
      fontSize: '0.75rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
      animation: isExpired ? 'none' : urgency === 'danger' ? 'countdown-pulse 1s ease-in-out infinite' : 'none',
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
      </svg>
      {timeLeft}
    </span>
  );
}

// Modal Component
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-card animate-fade-in" style={{
        width: '100%', maxWidth: '480px', margin: '1rem',
        padding: '1.5rem',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '1.25rem',
        }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-heading)' }}>
            {title}
          </h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', padding: '0.25rem',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Spinner
export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span style={{
      width: `${size}px`, height: `${size}px`,
      border: '2px solid rgba(255,255,255,0.2)',
      borderTopColor: 'white', borderRadius: '50%',
      animation: 'spin 0.6s linear infinite',
      display: 'inline-block',
    }} />
  );
}

// Action Button with double-submit protection
interface ActionButtonProps {
  id: string;
  label: string;
  loadingLabel: string;
  onClick: () => Promise<void>;
  variant?: 'primary' | 'danger' | 'secondary';
  disabled?: boolean;
  style?: React.CSSProperties;
}

export function ActionButton({ id, label, loadingLabel, onClick, variant = 'primary', disabled, style: extraStyle }: ActionButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    if (loading || disabled) return;
    setLoading(true);
    try {
      await onClick();
    } finally {
      setLoading(false);
    }
  }, [loading, disabled, onClick]);

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: 'var(--gradient-primary)', color: 'white',
      border: 'none',
    },
    danger: {
      background: 'var(--accent-danger-bg)', color: 'var(--accent-danger)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
    },
    secondary: {
      background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
      border: '1px solid var(--border-primary)',
    },
  };

  return (
    <button
      id={id}
      onClick={handleClick}
      disabled={loading || disabled}
      style={{
        padding: '0.5rem 1rem',
        borderRadius: 'var(--radius-md)',
        fontSize: '0.8rem', fontWeight: 600,
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        opacity: loading || disabled ? 0.7 : 1,
        transition: 'all var(--transition-fast)',
        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
        whiteSpace: 'nowrap',
        ...variantStyles[variant],
        ...extraStyle,
      }}
    >
      {loading && <Spinner size={14} />}
      {loading ? loadingLabel : label}
    </button>
  );
}

// Reusable Pagination Component
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50],
}: PaginationProps) {
  if (totalPages <= 1 && (totalItems === undefined || totalItems <= pageSize)) return null;

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = totalItems !== undefined ? Math.min(currentPage * pageSize, totalItems) : 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '1.25rem',
        paddingTop: '1rem',
        borderTop: '1px solid var(--border-secondary)',
        flexWrap: 'wrap',
        gap: '0.75rem',
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {totalItems !== undefined && (
          <span>
            Showing <strong style={{ color: 'var(--text-primary)' }}>{startItem}</strong> to{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{endItem}</strong> of{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{totalItems}</strong> entries
          </span>
        )}

        {onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <label htmlFor="page-size-select">Per page:</label>
            <select
              id="page-size-select"
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              style={{
                padding: '0.2rem 0.4rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-primary)',
                color: 'var(--text-primary)',
                fontSize: '0.78rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          style={{
            padding: '0.35rem 0.65rem',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-primary)',
            color: currentPage <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
            cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
            opacity: currentPage <= 1 ? 0.5 : 1,
            fontSize: '0.8rem',
            fontWeight: 500,
          }}
        >
          Previous
        </button>

        <span style={{ padding: '0 0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Page {currentPage} of {Math.max(1, totalPages)}
        </span>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          style={{
            padding: '0.35rem 0.65rem',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-primary)',
            color: currentPage >= totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
            cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
            opacity: currentPage >= totalPages ? 0.5 : 1,
            fontSize: '0.8rem',
            fontWeight: 500,
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
}

// Skeleton loader primitives
export function Skeleton({
  width = '100%',
  height = '1rem',
  borderRadius = 'var(--radius-sm)',
  style,
}: {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="skeleton"
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
    />
  );
}

export function SkeletonCard({ count = 6 }: { count?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton width="60%" height="1.2rem" />
            <Skeleton width="70px" height="1.4rem" borderRadius="9999px" />
          </div>
          <Skeleton width="40%" height="0.8rem" />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <Skeleton width="30%" height="0.8rem" />
            <Skeleton width="30%" height="0.8rem" />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <Skeleton width="48%" height="2rem" borderRadius="var(--radius-md)" />
            <Skeleton width="48%" height="2rem" borderRadius="var(--radius-md)" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="glass-card" style={{ padding: '1rem', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: '1rem', paddingBottom: '0.75rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-primary)' }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} width={`${100 / columns}%`} height="1rem" />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {Array.from({ length: columns }).map((_, j) => (
              <Skeleton key={j} width={`${100 / columns}%`} height="1.2rem" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

