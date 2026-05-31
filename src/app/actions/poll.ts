"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase";
import { resolveCustomerId } from "./_customer";
import type { SectionCommentRow } from "@/lib/database.types";

export async function pollManualState(customerId: string): Promise<{
  completedTaskIds: string[];
  comments: SectionCommentRow[];
}> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");

  const memberCustomerId = await resolveCustomerId(userId);
  if (memberCustomerId !== customerId) {
    const user = await currentUser();
    const isAdmin = (user?.publicMetadata as { role?: string })?.role === "admin";
    if (!isAdmin) throw new Error("Unauthorized");
  }

  const supabase = createServiceClient();

  const [{ data: completions }, { data: comments }] = await Promise.all([
    supabase.from("task_completions").select("task_id").eq("customer_id", customerId),
    supabase
      .from("section_comments")
      .select("id, customer_id, section_key, comment_text, user_initials, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: true }),
  ]);

  return {
    completedTaskIds: (completions ?? []).map((r) => r.task_id),
    comments: (comments ?? []) as SectionCommentRow[],
  };
}
