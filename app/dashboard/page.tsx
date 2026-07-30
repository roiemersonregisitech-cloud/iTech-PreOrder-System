import { getSession } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const supabase = await createServiceClient();
  const branchId = session.staff.branch_id;
  const isSuperAdmin = session.staff.role === 'super_admin';

  // Fetch stats
  const pendingQuery = supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('status', 'pending');
  if (!isSuperAdmin && branchId) pendingQuery.eq('branch_id', branchId);
  const { count: pendingCount } = await pendingQuery;

  const activePreordersQuery = supabase.from('preorders').select('id', { count: 'exact', head: true }).eq('status', 'active');
  if (!isSuperAdmin && branchId) activePreordersQuery.eq('branch_id', branchId);
  const { count: activePreorders } = await activePreordersQuery;

  let totalProducts = 0;
  let lowStockCount = 0;
  const inventoryQuery = supabase.from('inventory').select('qty_on_hand, qty_reserved');
  if (!isSuperAdmin && branchId) inventoryQuery.eq('branch_id', branchId);
  const { data: inventoryData } = await inventoryQuery;
  if (inventoryData) {
    totalProducts = inventoryData.length;
    lowStockCount = inventoryData.filter(i => (i.qty_on_hand - i.qty_reserved) <= 5).length;
  }

  const stats = [
    {
      label: 'Pending Reservations',
      value: pendingCount || 0,
      color: 'var(--accent-warning)',
      bg: 'var(--accent-warning-bg)',
      icon: '⏳',
      href: '/dashboard/reservations?status=pending',
    },
    {
      label: 'Active Preorders',
      value: activePreorders || 0,
      color: 'var(--accent-info)',
      bg: 'var(--accent-info-bg)',
      icon: '📋',
      href: '/dashboard/preorders',
    },
    {
      label: 'Products Tracked',
      value: totalProducts,
      color: 'var(--accent-success)',
      bg: 'var(--accent-success-bg)',
      icon: '📦',
      href: '/dashboard/inventory',
    },
    {
      label: 'Low Stock Items',
      value: lowStockCount,
      color: lowStockCount > 0 ? 'var(--accent-danger)' : 'var(--accent-success)',
      bg: lowStockCount > 0 ? 'var(--accent-danger-bg)' : 'var(--accent-success-bg)',
      icon: '⚠️',
      href: '/dashboard/inventory',
    },
  ];

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{
          fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-heading)',
          marginBottom: '0.25rem',
        }}>
          Welcome back, {session.staff.full_name.split(' ')[0]}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {isSuperAdmin
            ? 'Here\'s an overview across all branches.'
            : `Here's what's happening at ${session.staff.branch?.name || 'your branch'}.`
          }
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="glass-card"
            style={{
              padding: '1.25rem',
              textDecoration: 'none',
              display: 'block',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '0.75rem',
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {stat.label}
              </span>
              <span style={{
                width: '32px', height: '32px', borderRadius: 'var(--radius-sm)',
                background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem',
              }}>
                {stat.icon}
              </span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: stat.color }}>
              {stat.value}
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '1rem' }}>
          Quick Actions
        </h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link href="/dashboard/reservations" style={{
            padding: '0.625rem 1.25rem', borderRadius: 'var(--radius-md)',
            background: 'var(--gradient-primary)', color: 'white',
            textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            transition: 'all var(--transition-fast)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Reservation
          </Link>
          <Link href="/dashboard/preorders" style={{
            padding: '0.625rem 1.25rem', borderRadius: 'var(--radius-md)',
            background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
            border: '1px solid var(--border-primary)',
            textDecoration: 'none', fontSize: '0.85rem', fontWeight: 500,
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            transition: 'all var(--transition-fast)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Lookup Preorder
          </Link>
        </div>
      </div>
    </div>
  );
}
