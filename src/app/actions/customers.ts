"use server";

import { currentUser } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase";
import { redirect } from "next/navigation";

type ActionState = { error: string } | null;

async function requireAdmin() {
  const user = await currentUser();
  if (!user) throw new Error("Unauthenticated");
  const role = (user.publicMetadata as { role?: string })?.role;
  if (role !== "admin") throw new Error("Forbidden");
  return user.id;
}

export async function createCustomer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: String(e) };
  }

  const supabase = createServiceClient();

  const company_name = String(formData.get("company_name") ?? "").trim();
  const clerk_user_id = String(formData.get("clerk_user_id") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase().replace(/\s+/g, "-");

  if (!company_name || !clerk_user_id || !slug) {
    return { error: "All fields are required" };
  }

  const { error } = await supabase
    .from("customers")
    .insert({ company_name, clerk_user_id, slug });

  if (error) return { error: error.message };

  redirect("/admin/customers");
}

export async function updateCustomer(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: String(e) };
  }

  const supabase = createServiceClient();

  const company_name = String(formData.get("company_name") ?? "").trim();
  const clerk_user_id = String(formData.get("clerk_user_id") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase().replace(/\s+/g, "-");

  if (!company_name || !clerk_user_id || !slug) {
    return { error: "All fields are required" };
  }

  const { error } = await supabase
    .from("customers")
    .update({ company_name, clerk_user_id, slug })
    .eq("id", id);

  if (error) return { error: error.message };

  redirect("/admin/customers");
}

export async function deleteCustomer(id: string) {
  await requireAdmin();
  const supabase = createServiceClient();
  await supabase.from("customers").delete().eq("id", id);
  redirect("/admin/customers");
}
