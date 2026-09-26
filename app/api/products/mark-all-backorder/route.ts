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

    const supabase = await createServiceClient();

    // Update all products to allow backorder
    const { error } = await supabase
      .from("products")
      .update({ backorder_allowed: true })
      .neq('backorder_allowed', true); // Only update ones that aren't already true

    if (error) {
      console.error("Error marking all products as allow backorder:", error);
      return NextResponse.json(
        { error: "Failed to update products" },
        { status: 500 },
      );
    }

    await writeAuditLog({
      userId: session.userId,
      action: "product.mark_all_backorder",
      entityType: "product",
      metadata: { action: 'Marked all products to allow backorder' },
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
