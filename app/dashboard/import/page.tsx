import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import ImportClient from "./import-client";

export default async function ImportPage() {
  const session = await getSession();
  if (!session || session.staff.role !== "super_admin") {
    redirect("/dashboard");
  }
  return <ImportClient />;
}
