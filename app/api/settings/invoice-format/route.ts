import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServiceClient();

    const { data: globalSetting } = await supabase
      .from('settings')
      .select('*')
      .eq('key', 'invoice_length')
      .single();

    return NextResponse.json({
      invoice_length: globalSetting ? Number(globalSetting.value) : 6,
    });
  } catch (err) {
    console.error('GET invoice settings error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!hasRole(session.staff.role, 'super_admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { invoice_length } = body;

    if (invoice_length !== undefined && (invoice_length < 4 || invoice_length > 20)) {
      return NextResponse.json({ error: 'Invoice length must be between 4 and 20' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    if (invoice_length !== undefined) {
      await supabase.from('settings').upsert({
        key: 'invoice_length',
        value: invoice_length,
        updated_at: new Date().toISOString(),
        updated_by: session.userId,
      }, { onConflict: 'key' });
    }

    await writeAuditLog({
      userId: session.userId, action: 'settings.update',
      entityType: 'settings', metadata: { invoice_length },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PUT invoice settings error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
