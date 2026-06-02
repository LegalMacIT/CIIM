import { currentUser } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import { mergeTemplate, splitManual } from "@/lib/template-engine";
import { CREDENTIAL_KEYS } from "@/lib/fields";
import PrintButton from "@/app/(customer)/manual/PrintButton";
import SendInviteButton from "@/app/(customer)/manual/SendInviteButton";
import ManualClient from "@/app/(customer)/manual/ManualClient";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function AdminManualPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await currentUser();
  if (!user || (user.publicMetadata as { role?: string })?.role !== "admin") redirect("/sign-in");

  const supabase = createServiceClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("id, company_name")
    .eq("id", id)
    .single();

  if (!customer) notFound();

  const { data: template } = await supabase
    .from("template_versions")
    .select("html_content, version")
    .eq("is_active", true)
    .single();

  if (!template) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">No active template</h1>
        <p className="text-gray-500 text-sm">Upload a template on the Template page first.</p>
      </div>
    );
  }

  const { data: savedValues } = await supabase
    .from("form_values")
    .select("field_key, field_value")
    .eq("customer_id", id);

  const values: Record<string, string> = {};
  for (const row of savedValues ?? []) {
    if (!CREDENTIAL_KEYS.has(row.field_key)) {
      values[row.field_key] = row.field_value ?? "";
    }
  }

  const { data: completions } = await supabase
    .from("task_completions")
    .select("task_id")
    .eq("customer_id", id);

  const completedTaskIds = (completions ?? []).map((r) => r.task_id);

  const { data: comments } = await supabase
    .from("section_comments")
    .select("id, customer_id, section_key, comment_text, user_initials, created_at")
    .eq("customer_id", id)
    .order("created_at", { ascending: true });

  const adminInitials =
    [user.firstName?.[0], user.lastName?.[0]]
      .filter(Boolean)
      .join("")
      .toUpperCase() || "AD";

  const mergedHtml = mergeTemplate(template.html_content, values);
  const parts = splitManual(mergedHtml);

  return (
    <>
      <div className="print:hidden sticky top-0 z-10 bg-white border-b px-8 py-0 flex items-stretch justify-between">
        <div className="flex items-stretch gap-6">
          <Link href={`/admin/customers/${id}`} className="flex items-center">
            <Button variant="ghost" size="sm">← {customer.company_name}</Button>
          </Link>
          <span className="flex items-center text-sm text-gray-500">
            {customer.company_name} — Migration Manual (v{template.version})
            <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded">Admin View</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-400 hidden sm:block">Use Chrome or Edge for best PDF results</p>
          <SendInviteButton
            disabled={!values["final_trans_date"] || !values["final_trans_hour"]}
            adminCustomerId={id}
          />
          <PrintButton />
        </div>
      </div>

      <div className="px-4 py-6 print:px-0 print:py-0">
        <ManualClient
          parts={parts}
          initialCompletedIds={completedTaskIds}
          initialComments={comments ?? []}
          userInitials={adminInitials}
          allValues={values}
          customerId={id}
          adminCustomerId={id}
        />
      </div>
    </>
  );
}
