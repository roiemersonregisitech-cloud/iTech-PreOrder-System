import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { writeAuditLog } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const supabase = await createClient();

    if (session) {
      await writeAuditLog({
        userId: session.userId,
        action: 'auth.logout',
        entityType: 'staff',
        entityId: session.userId,
        request,
      });
    }

    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
