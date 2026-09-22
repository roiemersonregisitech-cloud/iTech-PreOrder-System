'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type Staff } from '@/lib/types';

interface SidebarProps {
  staff: Staff;
}

const navItems = {
  cashier: [
    { href: '/dashboard', label: 'Dashboard', icon: 'grid' },
    { href: '/dashboard/reservations', label: 'Reservations', icon: 'clock' },
    { href: '/dashboard/inventory', label: 'Inventory', icon: 'package' },
    { href: '/dashboard/preorders', label: 'Preorders', icon: 'file-text' },
    { href: '/dashboard/deliveries', label: 'Customer Received', icon: 'truck' },
  ],
  branch_admin: [
    { href: '/dashboard', label: 'Dashboard', icon: 'grid' },
    { href: '/dashboard/reservations', label: 'Reservations', icon: 'clock' },
    { href: '/dashboard/inventory', label: 'Inventory', icon: 'package' },
    { href: '/dashboard/preorders', label: 'Preorders', icon: 'file-text' },
    { href: '/dashboard/deliveries', label: 'Customer Received', icon: 'truck' },
    { href: '/dashboard/staff', label: 'Staff', icon: 'users' },
    { href: '/dashboard/export', label: 'Export Data', icon: 'download' },
    { href: '/dashboard/audit-log', label: 'Audit Log', icon: 'list' },
  ],
  super_admin: [
    { href: '/dashboard', label: 'Dashboard', icon: 'grid' },
    { href: '/dashboard/reservations', label: 'Reservations', icon: 'clock' },
    { href: '/dashboard/inventory', label: 'Inventory', icon: 'package' },
    { href: '/dashboard/allocations', label: 'Allocations', icon: 'layers' },
    { href: '/dashboard/preorders', label: 'Preorders', icon: 'file-text' },
    { href: '/dashboard/deliveries', label: 'Customer Received', icon: 'truck' },
    { href: '/dashboard/branches', label: 'Branches', icon: 'map-pin' },
    { href: '/dashboard/products', label: 'Products', icon: 'box' },
    { href: '/dashboard/staff', label: 'Staff', icon: 'users' },
    { href: '/dashboard/settings', label: 'Settings', icon: 'settings' },
    { href: '/dashboard/export', label: 'Export Data', icon: 'download' },
    { href: '/dashboard/import', label: 'Import Data', icon: 'upload' },
    { href: '/dashboard/audit-log', label: 'Audit Log', icon: 'list' },
  ],
};

function getIcon(name: string) {
  const icons: Record<string, React.ReactNode> = {
    grid: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    clock: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>,
    package: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21,16V8a2,2,0,0,0-1-1.73l-7-4a2,2,0,0,0-2,0l-7,4A2,2,0,0,0,3,8v8a2,2,0,0,0,1,1.73l7,4a2,2,0,0,0,2,0l7-4A2,2,0,0,0,21,16Z"/><polyline points="3.27,6.96 12,12.01 20.73,6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
    layers: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
    'file-text': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14,2H6A2,2,0,0,0,4,4V20a2,2,0,0,0,2,2H18a2,2,0,0,0,2-2V8Z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>,
    users: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17,21v-2a4,4,0,0,0-4-4H5a4,4,0,0,0-4,4v2"/><circle cx="9" cy="7" r="4"/><path d="M23,21v-2a4,4,0,0,0-3-3.87"/><path d="M16,3.13a4,4,0,0,1,0,7.75"/></svg>,
    list: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
    'map-pin': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21,10c0,7-9,13-9,13s-9-6-9-13a9,9,0,0,1,18,0Z"/><circle cx="12" cy="10" r="3"/></svg>,
    box: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21,16V8a2,2,0,0,0-1-1.73l-7-4a2,2,0,0,0-2,0l-7,4A2,2,0,0,0,3,8v8a2,2,0,0,0,1,1.73l7,4a2,2,0,0,0,2,0l7-4A2,2,0,0,0,21,16Z"/></svg>,
    settings: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4,15a1.65,1.65,0,0,0,.33,1.82l.06.06a2,2,0,0,1-2.83,2.83l-.06-.06a1.65,1.65,0,0,0-1.82-.33,1.65,1.65,0,0,0-1,1.51V21a2,2,0,0,1-4,0v-.09A1.65,1.65,0,0,0,9,19.4a1.65,1.65,0,0,0-1.82.33l-.06.06a2,2,0,0,1-2.83-2.83l.06-.06A1.65,1.65,0,0,0,4.68,15a1.65,1.65,0,0,0-1.51-1H3a2,2,0,0,1,0-4h.09A1.65,1.65,0,0,0,4.6,9a1.65,1.65,0,0,0-.33-1.82l-.06-.06A2,2,0,0,1,7.04,4.29l.06.06A1.65,1.65,0,0,0,9,4.68a1.65,1.65,0,0,0,1-1.51V3a2,2,0,0,1,4,0v.09a1.65,1.65,0,0,0,1,1.51,1.65,1.65,0,0,0,1.82-.33l.06-.06a2,2,0,0,1,2.83,2.83l-.06.06A1.65,1.65,0,0,0,19.4,9a1.65,1.65,0,0,0,1.51,1H21a2,2,0,0,1,0,4h-.09A1.65,1.65,0,0,0,19.4,15Z"/></svg>,
    truck: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16,8 20,8 23,11 23,16 16,16 16,8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
    download: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    upload: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  };
  return icons[name] || icons.grid;
}

export function Sidebar({ staff }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const items = navItems[staff.role] || navItems.cashier;

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const roleBadgeColor = {
    cashier: 'var(--accent-info)',
    branch_admin: 'var(--accent-warning)',
    super_admin: 'var(--accent-danger)',
  }[staff.role];

  const roleLabel = {
    cashier: 'Cashier',
    branch_admin: 'Branch Admin',
    super_admin: 'Super Admin',
  }[staff.role];

  return (
    <aside className="sidebar" style={{
      position: 'fixed', top: 0, left: 0,
      width: '260px', height: '100vh',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-secondary)',
      display: 'flex', flexDirection: 'column',
      zIndex: 50,
    }}>
      {/* Brand */}
      <div style={{
        padding: '1.25rem 1.5rem',
        borderBottom: '1px solid var(--border-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: 'var(--radius-sm)',
            background: 'var(--gradient-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 01-8 0" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-heading)' }}>
              iTech PreOrder
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Reservation System
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '0.75rem', overflowY: 'auto' }}>
        {items.map(item => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.625rem 0.875rem',
                borderRadius: 'var(--radius-md)',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                background: isActive ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                fontSize: '0.875rem', fontWeight: isActive ? 600 : 400,
                textDecoration: 'none',
                transition: 'all var(--transition-fast)',
                marginBottom: '2px',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--bg-hover)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              {getIcon(item.icon)}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      <div style={{
        padding: '1rem 1.25rem',
        borderTop: '1px solid var(--border-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'var(--bg-tertiary)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.8rem',
            flexShrink: 0,
          }}>
            {staff.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{
              fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {staff.full_name}
            </div>
            <div style={{
              fontSize: '0.7rem', fontWeight: 600,
              color: roleBadgeColor, textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {roleLabel}
            </div>
          </div>
        </div>
        {staff.branch && (
          <div style={{
            padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-tertiary)', fontSize: '0.7rem',
            color: 'var(--text-muted)', marginBottom: '0.75rem',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21,10c0,7-9,13-9,13s-9-6-9-13a9,9,0,0,1,18,0Z"/><circle cx="12" cy="10" r="3"/></svg>
            {staff.branch.name} ({staff.branch.code})
          </div>
        )}
        <button
          id="logout-button"
          onClick={handleLogout}
          style={{
            width: '100%', padding: '0.5rem',
            background: 'transparent', border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)',
            fontSize: '0.8rem', cursor: 'pointer',
            transition: 'all var(--transition-fast)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--accent-danger)';
            e.currentTarget.style.color = 'var(--accent-danger)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border-primary)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
