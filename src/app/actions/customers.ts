"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { encrypt, isCredentialField } from "@/lib/encryption";
import { BOOLEAN_KEYS } from "@/lib/fields";

type ActionState = { error: string } | null;

async function requireAdmin() {
  const user = await currentUser();
  if (!user) throw new Error("Unauthenticated");
  const role = (user.publicMetadata as { role?: string })?.role;
  if (role !== "admin") throw new Error("Forbidden");
  return user.id;
}

// Helper: bypass generated Supabase types for schema changes not yet reflected in codegen
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(supabase: ReturnType<typeof createServiceClient>): any {
  return supabase as any;
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

  if (!company_name || !slug) {
    return { error: "Company name and slug are required" };
  }

  const { data: newCustomer, error: insertError } = await db(supabase)
    .from("customers")
    .insert({ company_name, slug })
    .select("id")
    .single();

  if (insertError || !newCustomer) return { error: insertError?.message ?? "Failed to create customer" };

  if (clerk_user_id) {
    const { error: memberError } = await db(supabase)
      .from("customer_members")
      .insert({ customer_id: newCustomer.id, clerk_user_id });

    if (memberError) {
      await supabase.from("customers").delete().eq("id", newCustomer.id);
      return { error: memberError.message };
    }
  }

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
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase().replace(/\s+/g, "-");

  if (!company_name || !slug) {
    return { error: "All fields are required" };
  }

  const { error } = await supabase
    .from("customers")
    .update({ company_name, slug })
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

export async function addMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: String(e) };
  }

  const supabase = createServiceClient();

  const customer_id = String(formData.get("customer_id") ?? "").trim();
  const clerk_user_id = String(formData.get("clerk_user_id") ?? "").trim();

  if (!customer_id || !clerk_user_id) return { error: "Clerk user ID is required" };

  const { error } = await db(supabase)
    .from("customer_members")
    .insert({ customer_id, clerk_user_id });

  if (error) {
    return {
      error: (error.message ?? "").includes("unique")
        ? "That Clerk user ID is already assigned to a company"
        : error.message,
    };
  }

  revalidatePath(`/admin/customers/${customer_id}`);
  revalidatePath("/admin");
  return null;
}

export async function removeMember(customerId: string, clerkUserId: string) {
  await requireAdmin();
  const supabase = createServiceClient();
  await db(supabase)
    .from("customer_members")
    .delete()
    .eq("customer_id", customerId)
    .eq("clerk_user_id", clerkUserId);
  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin");
}

export async function markProjectComplete(customerId: string, complete: boolean) {
  await requireAdmin();
  const supabase = createServiceClient();
  await db(supabase).from("customers").update({ status: complete ? "complete" : "active" }).eq("id", customerId);
  revalidatePath("/admin");
  revalidatePath(`/admin/customers/${customerId}`);
}

export async function adminSaveFormValues(customerId: string, formData: FormData) {
  await requireAdmin();

  const supabase = createServiceClient();

  const entries: { customer_id: string; field_key: string; field_value: string }[] = [];

  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;

    let stored = value;

    if (isCredentialField(key)) {
      stored = value.trim() ? await encrypt(value) : "";
    } else if (BOOLEAN_KEYS.has(key)) {
      stored = value === "on" ? "x" : "";
    }

    entries.push({ customer_id: customerId, field_key: key, field_value: stored });
  }

  for (const boolKey of BOOLEAN_KEYS) {
    if (!formData.has(boolKey)) {
      entries.push({ customer_id: customerId, field_key: boolKey, field_value: "" });
    }
  }

  const { error } = await supabase
    .from("form_values")
    .upsert(entries, { onConflict: "customer_id,field_key" });

  if (error) throw new Error(`Failed to save: ${error.message}`);

  revalidatePath(`/admin/customers/${customerId}/configure`);
  revalidatePath(`/admin/customers/${customerId}/manual`);
  revalidatePath("/admin");
}
