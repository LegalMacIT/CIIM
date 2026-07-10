"use server";

import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_CUSTOMER_COOKIE, getUserCustomers } from "./_customer";

// Switches the signed-in user's active company (for users who belong to
// more than one) and sends them back to the dashboard with fresh data.
export async function setActiveCustomer(customerId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");

  const customers = await getUserCustomers(userId);
  if (!customers.some((c) => c.id === customerId)) {
    throw new Error("Not a member of that company");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_CUSTOMER_COOKIE, customerId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/dashboard");
}
