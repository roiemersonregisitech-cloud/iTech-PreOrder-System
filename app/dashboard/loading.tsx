import { SkeletonCard } from '@/components/ui';

export default function DashboardLoading() {
  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <div style={{
          width: '260px', height: '1.75rem', borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-tertiary)', marginBottom: '0.5rem',
        }} />
        <div style={{
          width: '340px', height: '0.9rem', borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-tertiary)',
        }} />
      </div>

      {/* Stat card skeletons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '0.75rem',
            }}>
              <div style={{
                width: '120px', height: '0.75rem', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-tertiary)',
              }} />
              <div style={{
                width: '32px', height: '32px', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-tertiary)',
              }} />
            </div>
            <div style={{
              width: '60px', height: '2rem', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-tertiary)',
            }} />
          </div>
        ))}
      </div>

      {/* Quick actions skeleton */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{
          width: '120px', height: '1rem', borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-tertiary)', marginBottom: '1rem',
        }} />
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{
            width: '160px', height: '38px', borderRadius: 'var(--radius-md)',
            background: 'var(--bg-tertiary)',
          }} />
          <div style={{
            width: '150px', height: '38px', borderRadius: 'var(--radius-md)',
            background: 'var(--bg-tertiary)',
          }} />
        </div>
      </div>

      {/* Chart skeleton */}
      <SkeletonCard count={1} />
    </div>
  );
}
