import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { Sidebar } from '@/components/sidebar';
import { MobileNavWrapper } from '@/components/mobile-nav-wrapper';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <MobileNavWrapper sidebar={<Sidebar staff={session.staff} />}>
        <main className="dashboard-main" style={{
          flex: 1,
          marginLeft: '260px',
          padding: '1.5rem 2rem',
          minHeight: '100vh',
          background: 'var(--bg-primary)',
        }}>
          {children}
        </main>
      </MobileNavWrapper>
    </div>
  );
}
