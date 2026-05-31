"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase";
import { resolveCustomerId } from "./_customer";

export async function toggleTaskCompletion(
  taskId: string,
  completed: boolean,
  adminCustomerId?: string
): Promise<void> {
  const { userId } = await auth();
  if (!userId) return;

  let customerId: string | null;
  if (adminCustomerId) {
    const user = await currentUser();
    if ((user?.publicMetadata as { role?: string })?.role !== "admin") return;
    customerId = adminCustomerId;
  } else {
    customerId = await resolveCustomerId(userId);
  }
  if (!customerId) return;

  const supabase = createServiceClient();

  if (completed) {
    await supabase
      .from("task_completions")
      .upsert({ customer_id: customerId, task_id: taskId }, { onConflict: "customer_id,task_id" });
  } else {
    await supabase
      .from("task_completions")
      .delete()
      .eq("customer_id", customerId)
      .eq("task_id", taskId);
  }
}
