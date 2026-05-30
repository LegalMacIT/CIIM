import { createServiceClient } from "@/lib/supabase";

export async function resolveCustomerId(userId: string): Promise<string | null> {
  const supabase = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("customer_members")
    .select("customer_id")
    .eq("clerk_user_id", userId)
    .single();
  return data?.customer_id ?? null;
}
