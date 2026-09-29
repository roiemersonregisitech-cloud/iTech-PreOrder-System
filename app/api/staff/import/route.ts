import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';

interface ImportRow {
  full_name: string;
  email: string;
  password: string;
  role: string;
  branch_code: string;
}

interface ImportResult {
  row: number;
  email: string;
  full_name: string;
  status: 'success' | 'error';
  error?: string;
}

// POST /api/staff/import — Bulk import staff from CSV data
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasRole(session.staff.role, 'super_admin')) {
      return NextResponse.json({ error: 'Only super admins can bulk import staff' }, { status: 403 });
    }

    const body = await request.json();
    const { rows } = body as { rows: ImportRow[] };

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    if (rows.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 rows per import' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Fetch all branches to map branch_code -> branch_id
    const { data: allBranches } = await supabase.from('branches').select('id, code, name');
    const branchMap = new Map<string, string>();
    (allBranches || []).forEach(b => branchMap.set(b.code.toLowerCase(), b.id));

    const validRoles = ['cashier', 'branch_admin', 'super_admin'];
    const results: ImportResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      // Validate required fields
      if (!row.full_name?.trim()) {
        results.push({ row: rowNum, email: row.email || '', full_name: '', status: 'error', error: 'Missing full_name' });
        errorCount++;
        continue;
      }
      if (!row.email?.trim()) {
        results.push({ row: rowNum, email: '', full_name: row.full_name, status: 'error', error: 'Missing email' });
        errorCount++;
        continue;
      }
      if (!row.password?.trim() || row.password.trim().length < 6) {
        results.push({ row: rowNum, email: row.email, full_name: row.full_name, status: 'error', error: 'Password must be at least 6 characters' });
        errorCount++;
        continue;
      }
      if (!row.role?.trim() || !validRoles.includes(row.role.trim().toLowerCase())) {
        results.push({ row: rowNum, email: row.email, full_name: row.full_name, status: 'error', error: `Invalid role "${row.role}". Must be: cashier, branch_admin, or super_admin` });
        errorCount++;
        continue;
      }
      if (!row.branch_code?.trim()) {
        results.push({ row: rowNum, email: row.email, full_name: row.full_name, status: 'error', error: 'Missing branch_code' });
        errorCount++;
        continue;
      }

      const branchId = branchMap.get(row.branch_code.trim().toLowerCase());
      if (!branchId) {
        results.push({ row: rowNum, email: row.email, full_name: row.full_name, status: 'error', error: `Branch code "${row.branch_code}" not found` });
        errorCount++;
        continue;
      }

      const role = row.role.trim().toLowerCase();
      const email = row.email.trim().toLowerCase();
      const fullName = row.full_name.trim();
      const password = row.password.trim();

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError) {
        results.push({ row: rowNum, email, full_name: fullName, status: 'error', error: authError.message });
        errorCount++;
        continue;
      }

      // Create staff record
      const { error: staffError } = await supabase.from('staff').insert({
        id: authData.user.id,
        branch_id: branchId,
        full_name: fullName,
        role,
      });

      if (staffError) {
        // Cleanup auth user
        await supabase.auth.admin.deleteUser(authData.user.id);
        results.push({ row: rowNum, email, full_name: fullName, status: 'error', error: 'Failed to create staff record' });
        errorCount++;
        continue;
      }

      // Audit log
      await writeAuditLog({
        userId: session.userId,
        action: 'staff.import',
        entityType: 'staff',
        entityId: authData.user.id,
        metadata: { email, role, branch_code: row.branch_code.trim(), full_name: fullName },
        request,
      });

      results.push({ row: rowNum, email, full_name: fullName, status: 'success' });
      successCount++;
    }

    return NextResponse.json({
      summary: { total: rows.length, success: successCount, errors: errorCount },
      results,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
