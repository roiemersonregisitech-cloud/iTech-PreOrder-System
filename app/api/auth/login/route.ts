import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Check staff record exists and is active
    const serviceClient = await createServiceClient();
    const { data: staff } = await serviceClient
      .from('staff')
      .select('*')
      .eq('id', data.user.id)
      .eq('is_active', true)
      .single();

    if (!staff) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 });
    }

    // Audit log
    await writeAuditLog({
      userId: data.user.id,
      action: 'auth.login',
      entityType: 'staff',
      entityId: data.user.id,
      metadata: { email },
      request,
    });

    return NextResponse.json({ user: data.user, staff });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
