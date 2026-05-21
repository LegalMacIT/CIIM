import { currentUser } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import { mergeTemplate, splitManual } from "@/lib/template-engine";
import { CREDENTIAL_KEYS } from "@/lib/fields";
import PrintButton from "@/app/(customer)/manual/PrintButton";
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
            {customer.company_name} — Migration Manual (v{template.version}) · Admin View
          </span>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-400 hidden sm:block">Use Chrome or Edge for best PDF results</p>
          <PrintButton />
        </div>
      </div>

      <div className="px-4 py-6 print:px-0 print:py-0">
        <div className="ciim-main" style={{ maxWidth: "780px", margin: "0 auto" }}>
          <div
            className="ciim-cover"
            dangerouslySetInnerHTML={{ __html: parts.coverHtml }}
          />
          <div
            className="ciim-preamble"
            dangerouslySetInnerHTML={{ __html: parts.preambleHtml }}
          />
          {parts.sections.map((section) =>
            !section.isEnabled ? null : (
              <div key={section.key} className="ciim-section" data-ciim-section={section.key}>
                <div className="ciim-section-bar">
                  <span className="ciim-section-name">{section.title}</span>
                </div>
                <div
                  className="ciim-section-content"
                  dangerouslySetInnerHTML={{ __html: section.html }}
                />
              </div>
            )
          )}
        </div>
      </div>

      <style>{`
        .ciim-main { font-size: 1rem; line-height: 1.45; color: #2c2c2c; font-family: var(--font-sans), "Source Sans 3", sans-serif; }
        .ciim-section { margin: 1.25rem 0; }
        .ciim-section-bar {
          display: flex; align-items: center; gap: 0.625rem;
          background: #8585a0; color: #fff;
          padding: 0.55rem 0.875rem; border-radius: 6px 6px 0 0;
        }
        .ciim-section-name { font-size: 1rem; font-weight: 700; color: #fff; letter-spacing: 0.01em; }
        .ciim-section-content {
          border: 1px solid #e5e7eb; border-top: none;
          border-radius: 0 0 6px 6px; padding: 1.25rem 1.5rem; background: #fff;
        }
        .ciim-section-content h1 { font-size: 2.25rem; font-weight: 700; line-height: 1.2; letter-spacing: -0.01em; margin: 1.75rem 0 0.75rem; color: #1a1a1a; }
        .ciim-section-content h2 { font-size: 1.5rem; font-weight: 700; margin: 1.5rem 0 0.5rem; color: #1a1a1a; }
        .ciim-section-content h3 { font-size: 1.1875rem; font-weight: 600; margin: 1.25rem 0 0.375rem; color: #1a1a1a; }
        .ciim-section-content h4 { font-size: 1rem; font-weight: 600; margin: 1rem 0 0.375rem; color: #1a1a1a; }
        .ciim-section-content p { margin: 0 0 0.625rem; }
        .ciim-section-content ul, .ciim-section-content ol { padding-left: 1.75rem; margin: 0 0 0.625rem; }
        .ciim-section-content li { margin-bottom: 0.3rem; }
        .ciim-section-content ol { list-style-type: decimal !important; }
        .ciim-section-content ul { list-style-type: disc !important; }
        .ciim-section-content table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: 0.9375rem; }
        .ciim-section-content td, .ciim-section-content th { border: 1px solid #e5e7eb; padding: 0.5rem 0.75rem; }
        .ciim-section-content th { background: #f5f5f5; font-weight: 600; text-align: left; }
        /* Layout tables (no header cells) — stack cells as single column */
        .ciim-section-content table:not(:has(th)) { border: none; width: auto; }
        .ciim-section-content table:not(:has(th)) tr { display: block; }
        .ciim-section-content table:not(:has(th)) td { display: block; border: none; padding: 0.1rem 0; }
        /* Callout boxes are always single-column — flatten any table inside them */
        .callout-it-box table { border: none; width: 100%; }
        .callout-it-box table tr { display: block; }
        .callout-it-box table td, .callout-it-box table th { display: block; border: none; padding: 0.1rem 0; }
        .ciim-section-content a { color: #1473e6; text-decoration: none; }
        .ciim-section-content a:hover { text-decoration: underline; }
        .ciim-section-content > h1:first-child,
        .ciim-section-content > h2:first-child,
        .ciim-section-content > h3:first-child { margin-top: 0.25rem; }
        .ciim-missing { background: #fef3c7; color: #92400e; padding: 0 0.25rem; border-radius: 0.2rem; font-style: italic; font-size: 0.875em; }
        .ciim-cover {
          border: 1.5px solid #d1d5db; border-top: 6px solid #8585a0;
          border-radius: 2px 2px 10px 10px; padding: 3rem 4rem 2.75rem;
          margin-bottom: 2.5rem; text-align: center;
          background: linear-gradient(180deg, #f9f9fb 0%, #ffffff 18%);
        }
        .ciim-cover img { width: calc(100% + 3rem); margin-left: -1.5rem; margin-right: -1.5rem; margin-bottom: 2.25rem; max-width: none; display: block; }
        .ciim-cover h1 { font-size: 3rem; font-weight: 700; background: linear-gradient(135deg, #1a1a1a 30%, #4a4870 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; letter-spacing: -0.03em; line-height: 1.1; margin: 0 0 0.375rem; }
        .ciim-cover h2 { font-size: 1.375rem; color: #4b5563; font-weight: 500; margin: 1.625rem 0 0.25rem; font-style: italic; }
        .ciim-cover h3 { font-size: 0.9rem; color: #374151; font-weight: 700; margin: 0.625rem 0 2.75rem; letter-spacing: 0.06em; text-transform: uppercase; }
        .ciim-cover p { margin: 0.375rem 0; color: #4b5563; font-size: 1rem; }
        .ciim-cover p:nth-last-of-type(2) { margin-top: 2.5rem; }
        .ciim-cover p:last-of-type { margin-top: 2rem; font-size: 0.8rem; color: #b0b0c0; font-style: italic; letter-spacing: 0.04em; padding-top: 1.5rem; border-top: 1px solid #e5e7eb; }
        .ciim-preamble { padding: 0 0 2rem; border-bottom: 1px solid #e5e7eb; margin-bottom: 2rem; font-size: 1rem; line-height: 1.45; color: #2c2c2c; }
        .ciim-preamble h2 { color: #374151; font-size: 1.25rem; font-weight: 700; margin: 1.5rem 0 0.5rem; }
        .ciim-preamble h3 { color: #6b7280; font-size: 1rem; font-weight: 600; margin: 1rem 0 0.375rem; }
        .ciim-preamble p { margin: 0.25rem 0 0.5rem; }
        .ciim-preamble ul, .ciim-preamble ol { margin: 0 0 0.625rem; padding-left: 1.5rem; }
        .ciim-preamble ol { list-style-type: decimal !important; }
        .ciim-preamble ul { list-style-type: disc !important; }
        .ciim-preamble a { color: #1473e6; text-decoration: none; }
        .callout-it-box { border-left: 4px solid #C55A11; background: #fff7f0; border-radius: 0 6px 6px 0; margin: 1rem 0; overflow: hidden; }
        .callout-it-header { background: #C55A11; color: #fff; font-weight: 700; font-size: 0.8125rem; letter-spacing: 0.02em; padding: 0.4rem 1rem; }
        .callout-it-box > p, .callout-it-box p { padding: 0.2rem 1rem; margin: 0; }
        .callout-info { border-left: 4px solid #1473e6; background: #f0f4fa; border-radius: 0 6px 6px 0; margin: 1rem 0; overflow: hidden; }
        .callout-info-header { background: #1473e6; color: #fff; font-weight: 700; font-size: 0.8125rem; padding: 0.4rem 1rem; }
        .callout-info p { padding: 0.4rem 1rem; margin: 0; }
        /* ── Word document color classes ── */
        .wc-c00000 { color: #C00000; }
        .wc-ff0000 { color: #FF0000; }
        .wc-e26b0a { color: #E26B0A; }
        .wc-c55a11 { color: #C55A11; }
        .wc-ed7d31 { color: #ED7D31; }
        .wc-ffc000 { color: #FFC000; }
        .wc-0070c0 { color: #0070C0; }
        .wc-4472c4 { color: #4472C4; }
        .wc-00b0f0 { color: #00B0F0; }
        .wc-17375e { color: #17375E; }
        .wc-00b050 { color: #00B050; }
        .wc-70ad47 { color: #70AD47; }
        .wc-548235 { color: #548235; }
        .wc-7030a0 { color: #7030A0; }
        .wc-8b4726 { color: #8B4726; }
        .wc-595959 { color: #595959; }
        .wc-404040 { color: #404040; }
        @media print {
          .ciim-section-bar { background: #8585a0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          span[class^="wc-"] { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 1in; }
        }
      `}</style>
    </>
  );
}
