import { NextRequest, NextResponse } from "next/server";
import { getSession, hasRole } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    const supabase = await createServiceClient();
    let query = supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error)
      return NextResponse.json(
        { error: "Failed to fetch products" },
        { status: 500 },
      );
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasRole(session.staff.role, "super_admin"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { sku, name, description, unit_price } = body;

    if (!sku || !name) {
      return NextResponse.json({ error: 'Missing sku or name' }, { status: 400 });
    }

    const cleanSku = String(sku).trim().toUpperCase();
    const cleanName = String(name).trim();

    if (!cleanSku || !cleanName) {
      return NextResponse.json(
        { error: 'Missing or empty sku or name' },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from("products")
      .insert({
        sku: cleanSku,
        name: cleanName,
        description: description ? description.trim() : null,
        unit_price: unit_price !== null && unit_price !== undefined ? parseFloat(unit_price) : null
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating product:", error);
      if (error.code === "23505")
        return NextResponse.json(
          { error: "SKU already exists" },
          { status: 409 },
        );
      return NextResponse.json(
        { error: error.message || "Failed to create product" },
        { status: 500 },
      );
    }

    // Auto-create inventory rows (qty=0) for all active branches
    const { data: branches } = await supabase
      .from("branches")
      .select("id")
      .eq("is_active", true);

    if (branches && branches.length > 0) {
      const inventoryRows = branches.map((b: { id: string }) => ({
        branch_id: b.id,
        product_id: data.id,
        qty_on_hand: 0,
        qty_reserved: 0,
      }));
      const { error: invError } = await supabase
        .from("inventory")
        .insert(inventoryRows);
      if (invError) {
        console.error("Error seeding inventory for new product:", invError);
      }
    }

    await writeAuditLog({
      userId: session.userId,
      action: "product.create",
      entityType: "product",
      entityId: data.id,
      metadata: { sku, name },
      request,
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
