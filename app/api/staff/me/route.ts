import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

// GET /api/staff/me — Get current authenticated staff member profile
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      userId: session.userId,
      staff: session.staff,
    });
  } catch (err) {
    console.error('GET /api/staff/me error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
