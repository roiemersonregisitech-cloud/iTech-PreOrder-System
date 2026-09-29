import { NextResponse } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';

// GET /api/staff/template — Download CSV template for bulk staff import
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasRole(session.staff.role, 'super_admin')) {
      return NextResponse.json({ error: 'Only super admins can download import templates' }, { status: 403 });
    }

    const csvHeader = 'full_name,email,password,role,branch_code';
    const exampleRows = [
      'John Doe,john@example.com,SecurePass123,cashier,BR001',
      'Jane Smith,jane@example.com,SecurePass456,branch_admin,BR002',
    ];

    const csvContent = [csvHeader, ...exampleRows].join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="staff_import_template.csv"',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
