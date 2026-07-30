import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(session.staff.role, 'super_admin'))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = await createServiceClient();
    const { data, error } = await supabase.from('branches')
      .select('*').order('name', { ascending: true });

    if (error) return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(session.staff.role, 'super_admin'))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { code, name } = body;
    if (!code || !name) return NextResponse.json({ error: 'Missing code or name' }, { status: 400 });

    const supabase = await createServiceClient();

    const { data, error } = await supabase.from('branches')
      .insert({ code: code.toUpperCase(), name }).select().single();

    if (error) {
      console.error('Error inserting branch:', error);
      if (error.code === '23505') return NextResponse.json({ error: 'Branch code already exists' }, { status: 409 });
      return NextResponse.json({ error: error.message || 'Failed to create branch' }, { status: 500 });
    }

    // Auto-create branch sequence
    const { error: seqError } = await supabase.from('branch_sequences').insert({ branch_id: data.id });
    if (seqError) {
      console.error('Error inserting branch sequence:', seqError);
    }

    // Auto-create inventory rows (qty=0) for all active products
    const { data: products } = await supabase
      .from('products')
      .select('id')
      .eq('is_active', true);

    if (products && products.length > 0) {
      const inventoryRows = products.map((p: { id: string }) => ({
        branch_id: data.id,
        product_id: p.id,
        qty_on_hand: 0,
        qty_reserved: 0,
      }));
      const { error: invError } = await supabase.from('inventory').insert(inventoryRows);
      if (invError) {
        console.error('Error seeding inventory for new branch:', invError);
      }
    }

    await writeAuditLog({
      userId: session.userId, action: 'branch.create',
      entityType: 'branch', entityId: data.id,
      metadata: { code, name }, request,
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (err: unknown) {
    console.error('Exception in POST /api/branches:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
