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
      .eq('key', 'reservation_timeout_minutes')
      .single();

    const { data: branchOverrides } = await supabase
      .from('branch_settings')
      .select('*, branch:branches(id, code, name)')
      .eq('key', 'reservation_timeout_minutes');

    // Map branch_settings rows to the shape the frontend expects:
    // { branch_id, timeout_minutes, branch: { id, code, name } }
    const mappedOverrides = (branchOverrides || []).map((row: Record<string, unknown>) => ({
      branch_id: row.branch_id,
      timeout_minutes: Number(row.value),
      branch: row.branch,
    }));

    return NextResponse.json({
      global_timeout_minutes: globalSetting ? Number(globalSetting.value) : 30,
      branch_overrides: mappedOverrides,
    });
  } catch (err) {
    console.error('GET settings error:', err);
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
    const { global_timeout_minutes, branch_overrides } = body;

    if (global_timeout_minutes !== undefined && (global_timeout_minutes < 1 || global_timeout_minutes > 1440)) {
      return NextResponse.json({ error: 'Timeout must be 1-1440 minutes' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    if (global_timeout_minutes !== undefined) {
      await supabase.from('settings').upsert({
        key: 'reservation_timeout_minutes',
        value: global_timeout_minutes,
        updated_at: new Date().toISOString(),
        updated_by: session.userId,
      }, { onConflict: 'key' });
    }

    if (branch_overrides && Array.isArray(branch_overrides)) {
      for (const o of branch_overrides) {
        if (o.timeout_minutes === null) {
          await supabase.from('branch_settings').delete()
            .eq('branch_id', o.branch_id).eq('key', 'reservation_timeout_minutes');
        } else {
          await supabase.from('branch_settings').upsert({
            branch_id: o.branch_id,
            key: 'reservation_timeout_minutes',
            value: o.timeout_minutes,
            updated_at: new Date().toISOString(),
            updated_by: session.userId,
          }, { onConflict: 'branch_id,key' });
        }
      }
    }

    await writeAuditLog({
      userId: session.userId, action: 'settings.update',
      entityType: 'settings', metadata: { global_timeout_minutes, branch_overrides },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PUT settings error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
