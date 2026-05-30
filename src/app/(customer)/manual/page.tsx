import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import { mergeTemplate, splitManual } from "@/lib/template-engine";
import { CREDENTIAL_KEYS } from "@/lib/fields";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import PrintButton from "./PrintButton";
import ManualClient from "./ManualClient";

export default async function ManualPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: memberRow } = await (supabase as any)
    .from("customer_members")
    .select("customer_id")
    .eq("clerk_user_id", userId)
    .single();

  const customerId = (memberRow as { customer_id: string } | null)?.customer_id;

  const { data: customer } = customerId
    ? await supabase.from("customers").select("id, company_name").eq("id", customerId).single()
    : { data: null };

  if (!customer) redirect("/dashboard");

  const { data: template } = await supabase
    .from("template_versions")
    .select("html_content, version")
    .eq("is_active", true)
    .single();

  if (!template) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Manual not yet available</h1>
        <p className="text-gray-500 text-sm">
          The CIIM template has not been uploaded yet. Please check back later.
        </p>
      </div>
    );
  }

  // Fetch field values (never send credentials to browser)
  const { data: savedValues } = await supabase
    .from("form_values")
    .select("field_key, field_value")
    .eq("customer_id", customer.id);

  const values: Record<string, string> = {};
  for (const row of savedValues ?? []) {
    if (!CREDENTIAL_KEYS.has(row.field_key)) {
      values[row.field_key] = row.field_value ?? "";
    }
  }

  // Fetch task completions
  const { data: completions } = await supabase
    .from("task_completions")
    .select("task_id")
    .eq("customer_id", customer.id);

  const completedTaskIds = (completions ?? []).map((r) => r.task_id);

  // Fetch comments
  const { data: comments } = await supabase
    .from("section_comments")
    .select("id, customer_id, section_key, comment_text, user_initials, created_at")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: true });

  // Derive user initials from Clerk
  const clerkUser = await currentUser();
  const userInitials =
    [clerkUser?.firstName?.[0], clerkUser?.lastName?.[0]]
      .filter(Boolean)
      .join("")
      .toUpperCase() || "?";

  const mergedHtml = mergeTemplate(template.html_content, values);
  const parts = splitManual(mergedHtml);

  return (
    <>
      {/* Toolbar — hidden when printing */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b px-8 py-0 flex items-stretch justify-between">
        <div className="flex items-stretch gap-6">
          <Link href="/dashboard" className="flex items-center">
            <Button variant="ghost" size="sm">← Configuration</Button>
          </Link>
          <span className="flex items-center text-sm text-gray-500">
            {customer.company_name} — Migration Manual (v{template.version})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-400 hidden sm:block">
            Use Chrome or Edge for best PDF results
          </p>
          <PrintButton />
        </div>
      </div>

      {/* Manual — interactive client component */}
      <div className="px-4 py-6 print:px-0 print:py-0">
        <ManualClient
          parts={parts}
          initialCompletedIds={completedTaskIds}
          initialComments={comments ?? []}
          userInitials={userInitials}
          allValues={values}
        />
      </div>


    </>
  );
}
