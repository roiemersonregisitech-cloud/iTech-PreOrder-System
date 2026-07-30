import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { Sidebar } from '@/components/sidebar';

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
      <Sidebar staff={session.staff} />
      <main style={{
        flex: 1,
        marginLeft: '260px',
        padding: '1.5rem 2rem',
        minHeight: '100vh',
        background: 'var(--bg-primary)',
      }}>
        {children}
      </main>
    </div>
  );
}
