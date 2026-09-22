import { SkeletonTable } from '@/components/ui';

export default function ExportLoading() {
  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <div style={{
          width: '160px', height: '1.75rem', borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-tertiary)', marginBottom: '0.5rem',
        }} />
        <div style={{
          width: '280px', height: '0.9rem', borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-tertiary)',
        }} />
      </div>

      {/* Filter bar skeleton */}
      <div className="glass-card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{
              width: '160px', height: '36px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-tertiary)',
            }} />
          ))}
        </div>
      </div>

      <SkeletonTable rows={8} columns={6} />
    </div>
  );
}
