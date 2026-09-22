'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';

interface MobileNavWrapperProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
}

export function MobileNavWrapper({ children, sidebar }: MobileNavWrapperProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);

  // Close sidebar when route changes (user tapped a link)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setSidebarOpen(false);
  }

  // Sync the open state to the DOM so CSS can target it
  useEffect(() => {
    const sidebarEl = document.querySelector('.sidebar');
    if (sidebarEl) {
      if (sidebarOpen) {
        sidebarEl.classList.add('open');
      } else {
        sidebarEl.classList.remove('open');
      }
    }
  }, [sidebarOpen]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <>
      {/* Mobile top header bar */}
      <div className="mobile-header">
        <button
          id="mobile-menu-toggle"
          onClick={toggleSidebar}
          aria-label="Toggle menu"
          style={{
            background: 'none', border: 'none', color: 'var(--text-primary)',
            cursor: 'pointer', padding: '0.5rem', display: 'flex', alignItems: 'center',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {sidebarOpen ? (
              <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
            ) : (
              <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>
            )}
          </svg>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: 'var(--radius-sm)',
            background: 'var(--gradient-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-heading)' }}>
            iTech PreOrder
          </span>
        </div>
      </div>

      {/* Backdrop overlay */}
      <div
        className={`sidebar-backdrop ${sidebarOpen ? 'active' : ''}`}
        onClick={closeSidebar}
      />

      {/* Sidebar — rendered as-is, className="sidebar" is already on the <aside> */}
      {sidebar}

      {/* Main content */}
      {children}
    </>
  );
}
