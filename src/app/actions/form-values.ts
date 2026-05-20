"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase";
import { encrypt, isCredentialField } from "@/lib/encryption";
import { BOOLEAN_KEYS } from "@/lib/fields";

async function resolveCustomerId(userId: string): Promise<string> {
  const supabase = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("customer_members")
    .select("customer_id")
    .eq("clerk_user_id", userId)
    .single();
  if (error || !data?.customer_id) throw new Error("Customer record not found");
  return data.customer_id as string;
}

export async function saveFormValues(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");

  const customerId = await resolveCustomerId(userId);
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

  revalidatePath("/dashboard");
  revalidatePath("/manual");
}

/** Toggle a single boolean section field on or off from the manual page. */
export async function saveBooleanField(fieldKey: string, enabled: boolean) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");

  const customerId = await resolveCustomerId(userId);
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("form_values")
    .upsert(
      { customer_id: customerId, field_key: fieldKey, field_value: enabled ? "x" : "" },
      { onConflict: "customer_id,field_key" }
    );

  if (error) throw new Error(`Failed to save: ${error.message}`);

  revalidatePath("/dashboard");
  revalidatePath("/manual");
}
