"use server";

import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase";

async function getCustomerId(userId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("customers")
    .select("id")
    .eq("clerk_user_id", userId)
    .single();
  return data?.id ?? null;
}

export async function toggleTaskCompletion(taskId: string, completed: boolean): Promise<void> {
  const { userId } = await auth();
  if (!userId) return;

  const customerId = await getCustomerId(userId);
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
