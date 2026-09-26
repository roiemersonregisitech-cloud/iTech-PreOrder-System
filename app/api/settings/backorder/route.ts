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
      .eq('key', 'backorder_enabled')
      .single();

    return NextResponse.json({
      backorder_enabled: globalSetting ? globalSetting.value === true || globalSetting.value === 'true' : false,
    });
  } catch (err) {
    console.error('GET backorder settings error:', err);
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
    const { backorder_enabled } = body;

    if (typeof backorder_enabled !== 'boolean') {
      return NextResponse.json({ error: 'backorder_enabled must be a boolean' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    await supabase.from('settings').upsert({
      key: 'backorder_enabled',
      value: backorder_enabled,
      updated_at: new Date().toISOString(),
      updated_by: session.userId,
    }, { onConflict: 'key' });

    await writeAuditLog({
      userId: session.userId, action: 'settings.update',
      entityType: 'settings', metadata: { backorder_enabled },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PUT backorder settings error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
