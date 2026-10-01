import { NextRequest, NextResponse } from "next/server";
import { getSession, hasRole } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasRole(session.staff.role, "super_admin"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    let allow = true;
    try {
      const body = await request.json();
      if (typeof body.allow === 'boolean') {
        allow = body.allow;
      }
    } catch {
      // Default to true if body is empty
    }

    const supabase = await createServiceClient();

    // Update all products to allow or disallow backorder
    const { error } = await supabase
      .from("products")
      .update({ backorder_allowed: allow })
      .neq('backorder_allowed', allow); // Only update ones that need it

    if (error) {
      console.error(`Error marking all products as allow backorder=${allow}:`, error);
      return NextResponse.json(
        { error: "Failed to update products" },
        { status: 500 },
      );
    }

    await writeAuditLog({
      userId: session.userId,
      action: "product.mark_all_backorder",
      entityType: "product",
      metadata: { action: `Marked all products to allow backorder: ${allow}` },
      request,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
