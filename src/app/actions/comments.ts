"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase";
import type { SectionCommentRow } from "@/lib/database.types";
import { resolveCustomerId } from "./_customer";

export async function addComment(
  sectionKey: string,
  commentText: string,
  userInitials: string,
  adminCustomerId?: string
): Promise<SectionCommentRow> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");

  let customerId: string | null;
  if (adminCustomerId) {
    const user = await currentUser();
    if ((user?.publicMetadata as { role?: string })?.role !== "admin") throw new Error("Unauthorized");
    customerId = adminCustomerId;
  } else {
    customerId = await resolveCustomerId(userId);
  }
  if (!customerId) throw new Error("Client not found");

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("section_comments")
    .insert({ customer_id: customerId, section_key: sectionKey, comment_text: commentText, user_initials: userInitials })
    .select("id, customer_id, section_key, comment_text, user_initials, created_at")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteComment(commentId: string, adminCustomerId?: string): Promise<void> {
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
  await supabase
    .from("section_comments")
    .delete()
    .eq("id", commentId)
    .eq("customer_id", customerId);
}
