"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import sanitizeHtml from "sanitize-html";
import { createServiceClient } from "@/lib/supabase";
import { resolveCustomerId } from "./_customer";

// Content comes from a browser contentEditable region shared between admin and
// customer users, so it's sanitized server-side before it's persisted and later
// echoed back via dangerouslySetInnerHTML to either party.
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "em", "b", "i", "u", "ul", "ol", "li", "a", "span"],
  allowedAttributes: { a: ["href"] },
  allowedSchemes: ["http", "https", "mailto"],
  // The Title Page's "Cloud iManage C2C Transition" line is a <p class="cover-title">
  // (mammoth maps Word's "Title" paragraph style to a class, not a heading tag), and it
  // stays part of the editable region since customers can rename it. Without this, the
  // blanket attribute-stripping above would drop the class along with everything else,
  // silently downgrading it to a plain paragraph the first time anyone saves an edit.
  allowedClasses: { p: ["cover-title"] },
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
  },
};

/** Save a customer's edit to a live-editable manual block (e.g. the Final Transition Cutover Checklist). */
export async function saveEditableBlock(blockKey: string, html: string, adminCustomerId?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");

  let customerId: string;
  if (adminCustomerId) {
    const user = await currentUser();
    if ((user?.publicMetadata as { role?: string })?.role !== "admin") throw new Error("Unauthorized");
    customerId = adminCustomerId;
  } else {
    const resolved = await resolveCustomerId(userId);
    if (!resolved) throw new Error("Client record not found");
    customerId = resolved;
  }

  const clean = sanitizeHtml(html, SANITIZE_OPTIONS).trim();
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("form_values")
    .upsert(
      { customer_id: customerId, field_key: `editable_${blockKey}`, field_value: clean },
      { onConflict: "customer_id,field_key" }
    );

  if (error) throw new Error(`Failed to save: ${error.message}`);

  revalidatePath("/dashboard");
  revalidatePath("/manual");
}
