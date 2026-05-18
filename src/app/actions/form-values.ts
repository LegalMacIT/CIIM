"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase";
import { encrypt, isCredentialField } from "@/lib/encryption";
import { BOOLEAN_KEYS } from "@/lib/fields";

export async function saveFormValues(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");

  const supabase = createServiceClient();

  // Resolve the customer row for this Clerk user
  const { data: customer, error: custError } = await supabase
    .from("customers")
    .select("id")
    .eq("clerk_user_id", userId)
    .single();

  if (custError || !customer) throw new Error("Customer record not found");

  const entries: { customer_id: string; field_key: string; field_value: string }[] = [];

  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;

    let stored = value;

    if (isCredentialField(key)) {
      // Encrypt credentials before storage; store empty string as empty (no encryption)
      stored = value.trim() ? await encrypt(value) : "";
    } else if (BOOLEAN_KEYS.has(key)) {
      // Checkboxes: "on" → "x", anything else → ""
      stored = value === "on" ? "x" : "";
    }

    entries.push({ customer_id: customer.id, field_key: key, field_value: stored });
  }

  // Boolean fields not present in FormData mean unchecked — set them to ""
  for (const boolKey of BOOLEAN_KEYS) {
    if (!formData.has(boolKey)) {
      entries.push({ customer_id: customer.id, field_key: boolKey, field_value: "" });
    }
  }

  const { error } = await supabase
    .from("form_values")
    .upsert(entries, { onConflict: "customer_id,field_key" });

  if (error) throw new Error(`Failed to save: ${error.message}`);

  revalidatePath("/dashboard");
  revalidatePath("/manual");
}

/** Toggle a single boolean section field on or off from the manual page. */
export async function saveBooleanField(fieldKey: string, enabled: boolean) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");

  const supabase = createServiceClient();

  const { data: customer, error: custError } = await supabase
    .from("customers")
    .select("id")
    .eq("clerk_user_id", userId)
    .single();

  if (custError || !customer) throw new Error("Customer record not found");

  const { error } = await supabase
    .from("form_values")
    .upsert(
      { customer_id: customer.id, field_key: fieldKey, field_value: enabled ? "x" : "" },
      { onConflict: "customer_id,field_key" }
    );

  if (error) throw new Error(`Failed to save: ${error.message}`);

  revalidatePath("/dashboard");
  revalidatePath("/manual");
}
