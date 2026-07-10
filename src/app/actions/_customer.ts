import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase";

export const ACTIVE_CUSTOMER_COOKIE = "ciim_active_customer";

export type MemberCustomer = { id: string; company_name: string; slug: string };

// All companies a Clerk user belongs to, via customer_members.
export async function getUserCustomers(userId: string): Promise<MemberCustomer[]> {
  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: memberRows } = await (supabase as any)
    .from("customer_members")
    .select("customer_id")
    .eq("clerk_user_id", userId);

  const customerIds = ((memberRows ?? []) as { customer_id: string }[]).map((r) => r.customer_id);
  if (customerIds.length === 0) return [];

  const { data: customers } = await supabase
    .from("customers")
    .select("id, company_name, slug")
    .in("id", customerIds);

  return (customers ?? []) as MemberCustomer[];
}

// The customer_id the current request should operate on: the user's only
// company if they have just one, otherwise whichever is marked "active" via
// cookie (falling back to the first membership if the cookie is unset/stale).
export async function resolveCustomerId(userId: string): Promise<string | null> {
  const customers = await getUserCustomers(userId);
  if (customers.length === 0) return null;
  if (customers.length === 1) return customers[0].id;

  const cookieStore = await cookies();
  const active = cookieStore.get(ACTIVE_CUSTOMER_COOKIE)?.value;
  if (active && customers.some((c) => c.id === active)) return active;
  return customers[0].id;
}
