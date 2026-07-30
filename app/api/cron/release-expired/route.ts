import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// POST /api/cron/release-expired — Fallback if pg_cron isn't available
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = await createServiceClient();
    const { error } = await supabase.rpc('release_expired_reservations');

    if (error) {
      console.error('Cron release-expired error:', error);
      return NextResponse.json({ error: 'Failed to release expired reservations' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Cron release-expired error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
