"use server";

import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase";
import type { SectionCommentRow } from "@/lib/database.types";
import { resolveCustomerId } from "./_customer";

export async function addComment(
  sectionKey: string,
  commentText: string,
  userInitials: string
): Promise<SectionCommentRow> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");

  const customerId = await resolveCustomerId(userId);
  if (!customerId) throw new Error("Customer not found");

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("section_comments")
    .insert({ customer_id: customerId, section_key: sectionKey, comment_text: commentText, user_initials: userInitials })
    .select("id, customer_id, section_key, comment_text, user_initials, created_at")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteComment(commentId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) return;

  const customerId = await resolveCustomerId(userId);
  if (!customerId) return;

  const supabase = createServiceClient();
  await supabase
    .from("section_comments")
    .delete()
    .eq("id", commentId)
    .eq("customer_id", customerId);
}
