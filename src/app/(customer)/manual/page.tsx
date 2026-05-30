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

      <style>{`
        /* ── Layout: sidebar + main ─────────────────────────── */
        .ciim-layout {
          display: flex; gap: 0; min-height: calc(100vh - 120px);
        }

        /* ── TOC Sidebar ────────────────────────────────────── */
        .ciim-toc {
          width: 210px; flex-shrink: 0;
          border-right: 1px solid #e5e7eb; background: #fafafa;
          position: sticky; top: 52px; height: calc(100vh - 52px);
          overflow-y: auto; padding: 1.25rem 0 2rem;
        }
        .ciim-toc-header {
          font-size: 0.6875rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.08em; color: #9ca3af;
          padding: 0 1rem 0.625rem; margin-bottom: 0.25rem;
          border-bottom: 1px solid #e5e7eb;
        }
        .ciim-toc-list { list-style: none; margin: 0; padding: 0.5rem 0 0; }
        .ciim-toc-item {
          display: flex; align-items: flex-start; gap: 0.375rem; width: 100%;
          padding: 0.35rem 1rem; text-align: left; background: none; border: none;
          font-size: 0.8125rem; line-height: 1.35; color: #6b7280;
          cursor: pointer; transition: color 0.12s, background 0.12s; border-radius: 0;
        }
        .ciim-toc-item:hover { color: #1a1a1a; background: #f3f4f6; }
        .ciim-toc-item--active { color: #8585a0; font-weight: 600; background: #f0f0f5; }
        .ciim-toc-item--done { color: #16a34a; }
        .ciim-toc-item--active.ciim-toc-item--done { color: #16a34a; background: #f0fdf4; }
        .ciim-toc-check { width: 1rem; flex-shrink: 0; font-size: 0.6875rem; margin-top: 0.1rem; color: #16a34a; }
        .ciim-toc-text { flex: 1; min-width: 0; }

        /* ── Main content area ──────────────────────────────── */
        .ciim-main {
          flex: 1; min-width: 0; padding: 1.75rem 2rem 3rem;
          max-width: 780px;
        }

        /* ── Right summary panel ──────────────────────────── */
        .ciim-summary-panel {
          width: 236px; flex-shrink: 0;
          border-left: 1px solid #e5e7eb; background: #fafafa;
          position: sticky; top: 52px; height: calc(100vh - 52px);
          overflow-y: auto; padding-bottom: 2rem;
        }
        .ciim-summary-header {
          background: #1a1a1a; color: #fff;
          padding: 0.625rem 1rem; font-size: 0.6875rem; font-weight: 700;
          letter-spacing: 0.07em; text-transform: uppercase;
          position: sticky; top: 0; z-index: 1;
        }
        .ciim-summary-section {
          border-bottom: 1px solid #f3f4f6; padding: 0.625rem 0.875rem;
        }
        .ciim-summary-section:last-child { border-bottom: none; }
        .ciim-summary-group-title {
          font-size: 0.625rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.07em; color: #C55A11; margin-bottom: 0.375rem;
        }
        .ciim-summary-row {
          display: flex; justify-content: space-between; align-items: baseline;
          gap: 0.375rem; margin-bottom: 0.2rem;
        }
        .ciim-summary-key {
          font-size: 0.75rem; color: #6b7280; flex-shrink: 0;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 46%;
        }
        .ciim-summary-val {
          font-size: 0.75rem; color: #1a1a1a; font-weight: 500;
          text-align: right; white-space: nowrap; overflow: hidden;
          text-overflow: ellipsis; max-width: 54%;
        }
        .ciim-summary-val--empty { color: #d1d5db; font-style: italic; }
        .ciim-summary-toggle-item {
          display: flex; align-items: flex-start; gap: 0.375rem;
          padding: 0.175rem 0; cursor: pointer; width: 100%;
        }
        .ciim-summary-toggle-cb {
          width: 0.875rem; height: 0.875rem; accent-color: #C55A11;
          cursor: pointer; flex-shrink: 0; margin-top: 0.125rem;
        }
        .ciim-summary-section-on { font-size: 0.75rem; color: #1a1a1a; line-height: 1.35; }
        .ciim-summary-section-off {
          font-size: 0.75rem; color: #d1d5db; text-decoration: line-through; line-height: 1.35;
        }

        /* ── Typography ─────────────────────────────────────── */
        .ciim-main, .ciim-preamble { font-size: 1rem; line-height: 1.45; color: #2c2c2c; font-family: var(--font-sans), "Source Sans 3", sans-serif; }
        .ciim-preamble h1, .ciim-section-content h1 { font-size: 2.25rem; font-weight: 400; line-height: 1.2; letter-spacing: -0.01em; margin: 1.75rem 0 0.75rem; color: #C55A11; }
        .ciim-preamble h2, .ciim-section-content h2 { font-size: 1.5rem; font-weight: 700; line-height: 1.25; margin: 1.5rem 0 0.5rem; color: #1a1a1a; }
        .ciim-preamble h3, .ciim-section-content h3 { font-size: 1.1875rem; font-weight: 600; line-height: 1.3; margin: 1.25rem 0 0.375rem; color: #1a1a1a; }
        .ciim-preamble h4, .ciim-section-content h4 { font-size: 1rem; font-weight: 600; line-height: 1.35; margin: 1rem 0 0.375rem; color: #1a1a1a; }
        .ciim-section-content p { margin: 0 0 0.625rem; }
        .ciim-section-content ul, .ciim-section-content ol { padding-left: 1.75rem; margin: 0 0 0.625rem; }
        .ciim-section-content li { margin-bottom: 0.3rem; }
        /* ── List numbering — preserve Word's scheme exactly ── */
        .ciim-section-content ol, .ciim-preamble ol { list-style-type: decimal !important; list-style-position: outside; }
        .ciim-section-content ol ol { list-style-type: lower-alpha !important; }
        .ciim-section-content ol ol ol { list-style-type: lower-roman !important; }
        .ciim-section-content ul, .ciim-preamble ul { list-style-type: disc !important; }
        .ciim-section-content ul ul { list-style-type: circle !important; }
        /* Honor explicit type attributes mammoth may output */
        .ciim-section-content ol[type="a"], .ciim-preamble ol[type="a"] { list-style-type: lower-alpha !important; }
        .ciim-section-content ol[type="A"] { list-style-type: upper-alpha !important; }
        .ciim-section-content ol[type="i"] { list-style-type: lower-roman !important; }
        .ciim-section-content ol[type="I"] { list-style-type: upper-roman !important; }
        /* start attribute handled natively by browsers — no CSS needed */
        .ciim-section-content table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: 0.9375rem; }
        .ciim-section-content td, .ciim-section-content th { border: 1px solid #e5e7eb; padding: 0.5rem 0.75rem; }
        .ciim-section-content th { background: #f5f5f5; font-weight: 600; text-align: left; }
        /* Layout tables (no header cells) — stack cells as single column */
        .ciim-section-content table:not(:has(th)) { display: block; border: none; width: auto; }
        .ciim-section-content table:not(:has(th)) tbody { display: block; }
        .ciim-section-content table:not(:has(th)) tr { display: block; }
        .ciim-section-content table:not(:has(th)) td { display: block; border: none; padding: 0.1rem 0; }
        /* Callout boxes are always single-column — flatten any table inside them */
        .callout-it-box table, .callout-info table { display: block; border: none; width: 100%; }
        .callout-it-box table tbody, .callout-info table tbody { display: block; }
        .callout-it-box table tr, .callout-info table tr { display: block; }
        .callout-it-box table td, .callout-it-box table th,
        .callout-info table td, .callout-info table th { display: block; border: none; padding: 0.1rem 0; }
        .ciim-section-content a { color: #1473e6; text-decoration: none; }
        .ciim-section-content a:hover { text-decoration: underline; }
        .ciim-missing { background: #fef3c7; color: #92400e; padding: 0 0.25rem; border-radius: 0.2rem; font-style: italic; font-size: 0.875em; }

        /* First heading inside section-content sits directly below the section bar — tighten gap */
        .ciim-section-content > h1:first-child,
        .ciim-section-content > h2:first-child,
        .ciim-section-content > h3:first-child { margin-top: 0.25rem; }

        /* ── Cover page — card container only; text uses document styles ── */
        .ciim-cover {
          border: 1.5px solid #d1d5db;
          border-top: 6px solid #8585a0;
          border-radius: 2px 2px 10px 10px;
          padding: 3rem 4rem 2.75rem;
          margin-bottom: 2.5rem;
          text-align: center;
          background: linear-gradient(180deg, #f9f9fb 0%, #ffffff 18%);
          box-shadow: 0 4px 28px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8);
        }
        .ciim-cover img { max-width: 100%; height: auto; display: block; margin: 0 auto 2rem; }
        .ciim-cover a { color: #8585a0; text-decoration: none; }
        .ciim-cover a:hover { text-decoration: underline; }

        /* ── Preamble (TOC, Important Links, etc.) ──────────── */
        .ciim-preamble {
          padding: 0 0 2rem;
          border-bottom: 1px solid #e5e7eb; margin-bottom: 2rem;
        }
        .ciim-preamble h2 { color: #374151; font-size: 1.25rem; font-weight: 700; margin: 1.5rem 0 0.5rem; }
        .ciim-preamble h3 { color: #6b7280; font-size: 1rem; font-weight: 600; margin: 1rem 0 0.375rem; }
        .ciim-preamble p { margin: 0.25rem 0 0.5rem; }
        .ciim-preamble ul, .ciim-preamble ol { margin: 0 0 0.625rem; padding-left: 1.5rem; }
        .ciim-preamble ol { list-style-type: decimal !important; }
        .ciim-preamble ul { list-style-type: disc !important; }
        .ciim-preamble a { color: #1473e6; text-decoration: none; }
        .ciim-preamble a:hover { text-decoration: underline; }

        /* Traditional TOC entries */
        .ciim-preamble p.toc-1,
        .ciim-preamble p.toc-2,
        .ciim-preamble p.toc-3 {
          display: flex; align-items: baseline; gap: 0.25rem;
          margin: 0.15rem 0; overflow: hidden;
        }
        .ciim-preamble p.toc-1 {
          font-weight: 600; color: #1a1a1a; font-size: 0.9375rem; padding-top: 0.3rem;
        }
        .ciim-preamble p.toc-2 { padding-left: 1.25rem; color: #374151; font-size: 0.875rem; }
        .ciim-preamble p.toc-3 { padding-left: 2.5rem; color: #6b7280; font-size: 0.8125rem; }
        /* Dot-leader fill between entry text and right edge */
        .ciim-preamble p.toc-1::after,
        .ciim-preamble p.toc-2::after,
        .ciim-preamble p.toc-3::after {
          content: "";
          flex: 1;
          margin: 0 0.25rem 0.2em;
          border-bottom: 1.5px dotted #d1d5db;
          min-width: 1rem;
        }
        /* Wrap any <a> inside toc entries to prevent the link eating the dot leaders */
        .ciim-preamble p.toc-1 a,
        .ciim-preamble p.toc-2 a,
        .ciim-preamble p.toc-3 a {
          color: inherit; text-decoration: none; white-space: nowrap;
        }
        .ciim-preamble p.toc-1 a:hover,
        .ciim-preamble p.toc-2 a:hover,
        .ciim-preamble p.toc-3 a:hover { text-decoration: underline; }

        /* ── Checkboxes ─────────────────────────────────────── */
        .ciim-section-content p.task-checkbox,
        .callout-it-box p.task-checkbox,
        .callout-it-box p.callout-it {
          display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.4rem;
        }
        .ciim-section-content p.task-checkbox input[type="checkbox"],
        .callout-it-box p.task-checkbox input[type="checkbox"],
        .callout-it-box p.callout-it input[type="checkbox"] {
          margin-top: 0.2rem; flex-shrink: 0; width: 1rem; height: 1rem; cursor: pointer; accent-color: #C55A11;
        }
        .ciim-section-content p.task-checkbox-indent,
        .callout-it-box p.task-checkbox-indent {
          padding-left: 2.25rem; font-size: 0.9375rem; color: #555; margin-bottom: 0.3rem;
        }
        .ciim-section-content p.code-line {
          font-family: var(--font-mono), monospace; font-size: 0.875rem; background: #f5f5f5;
          padding: 0.1rem 0.4rem; border-radius: 3px;
        }

        /* ── Orange IT Task callout ─────────────────────────── */
        .callout-it-box {
          border-left: 4px solid #C55A11; background: #fff7f0;
          border-radius: 0 6px 6px 0; margin: 1rem 0; overflow: hidden;
        }
        .callout-it-header {
          background: #C55A11; color: #fff;
          font-weight: 700; font-size: 0.8125rem; letter-spacing: 0.02em;
          padding: 0.4rem 1rem;
        }
        /* Single-column callout: all items stack vertically */
        .callout-it-box > p,
        .callout-it-box p.task-checkbox,
        .callout-it-box p.task-checkbox-indent,
        .callout-it-box p.callout-it { padding: 0.2rem 1rem; margin: 0; display: flex; }
        .callout-it-box ul, .callout-it-box ol {
          padding: 0.2rem 1rem 0.2rem 2.5rem; margin: 0;
        }

        /* ── Blue Helpful Insights callout ──────────────────── */
        .callout-info {
          border-left: 4px solid #1473e6; background: #f0f4fa;
          border-radius: 0 6px 6px 0; margin: 1rem 0; overflow: hidden;
        }
        .callout-info-header {
          background: #1473e6; color: #fff;
          font-weight: 700; font-size: 0.8125rem; letter-spacing: 0.02em;
          padding: 0.4rem 1rem;
        }
        .callout-info p { padding: 0.4rem 1rem; margin: 0; }
        .callout-info ul, .callout-info ol { padding: 0.25rem 1rem 0.25rem 2.5rem; margin: 0; }

        /* ── Gamification: XP badge ─────────────────────────── */
        .ciim-xp-badge {
          display: inline-flex; align-items: center; padding: 0.25rem 0.75rem;
          border-radius: 9999px; color: #fff; font-size: 0.8rem; font-weight: 700;
          letter-spacing: 0.03em; white-space: nowrap; transition: background 0.5s ease;
          flex-shrink: 0;
        }

        /* ── Achievement toast ──────────────────────────────── */
        .ciim-achievement {
          position: fixed; top: 3.75rem; right: 1.5rem; z-index: 200;
          background: #1a1a1a; color: #fff;
          padding: 0.7rem 1.25rem; border-radius: 8px;
          font-size: 0.9375rem; font-weight: 600;
          box-shadow: 0 8px 24px rgba(0,0,0,0.22);
          animation: ciim-toast-in 0.3s ease;
          max-width: 320px;
        }
        @keyframes ciim-toast-in {
          from { transform: translateX(110%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }

        /* ── Overall progress bar ───────────────────────────── */
        .ciim-overall-progress {
          display: flex; align-items: center; gap: 0.875rem;
          background: #fff; border: 1px solid #e5e7eb; border-radius: 8px;
          padding: 0.75rem 1rem; margin-bottom: 1.25rem;
        }
        .ciim-overall-progress-track {
          flex: 1; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden;
        }
        .ciim-overall-progress-fill {
          height: 100%; background: #C55A11; border-radius: 4px; transition: width 0.35s ease;
        }
        .ciim-overall-progress-label { font-size: 0.8125rem; color: #6b7280; white-space: nowrap; }

        /* ── Comments panel ─────────────────────────────────── */
        .ciim-comments-panel {
          border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 1.25rem; overflow: hidden;
        }
        .ciim-comments-toggle {
          width: 100%; display: flex; align-items: center; gap: 0.5rem;
          padding: 0.65rem 1rem; background: #f9fafb; border: none; cursor: pointer;
          font-size: 0.875rem; font-weight: 600; color: #374151; text-align: left;
        }
        .ciim-comments-toggle:hover { background: #f3f4f6; }
        .ciim-comments-grid-wrapper { padding: 0.625rem 1rem; overflow-x: auto; }
        .ciim-comments-grid {
          display: grid; grid-template-columns: 2fr 0.4fr 0.7fr 3fr 0.3fr;
          gap: 0.2rem 0.625rem; font-size: 0.875rem; align-items: start;
        }
        .ciim-comments-col-head {
          font-weight: 600; color: #6b7280; font-size: 0.6875rem; text-transform: uppercase;
          letter-spacing: 0.05em; padding-bottom: 0.375rem; border-bottom: 1px solid #e5e7eb;
        }
        .ciim-comments-cell { padding: 0.3rem 0; border-bottom: 1px solid #f3f4f6; color: #374151; font-size: 0.875rem; }
        .ciim-comment-initials { font-weight: 600; color: #C55A11; }
        .ciim-comment-date { color: #9ca3af; font-size: 0.8125rem; }
        .ciim-comment-delete {
          background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 1rem; padding: 0 0.25rem;
        }
        .ciim-comment-delete:hover { color: #ef4444; }

        /* ── Section ────────────────────────────────────────── */
        .ciim-section { margin: 1.25rem 0; }

        /* ── Section title bar — Pewter ─────────────────────── */
        .ciim-section-bar {
          display: flex; align-items: center; gap: 0.625rem;
          background: #8585a0; color: #fff;
          padding: 0.55rem 0.875rem; border-radius: 6px 6px 0 0;
          user-select: none;
        }
        .ciim-section-bar--done { background: #166534; }
        .ciim-collapse-btn {
          background: none; border: none; color: rgba(255,255,255,0.9); cursor: pointer;
          font-size: 0.65rem; padding: 0; width: 1.1rem; flex-shrink: 0;
        }
        .ciim-section-bar-title {
          flex: 1; display: flex; align-items: center; gap: 0.625rem; min-width: 0;
        }
        .ciim-section-name {
          font-size: 1rem; font-weight: 700; color: #fff; white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis; letter-spacing: 0.01em;
        }
        .ciim-section-done-badge {
          font-size: 0.6875rem; font-weight: 700; background: #16a34a; color: #fff;
          padding: 0.1rem 0.5rem; border-radius: 9999px; flex-shrink: 0;
        }
        .ciim-section-bar-right {
          display: flex; align-items: center; gap: 0.625rem; flex-shrink: 0;
        }
        .ciim-section-meter { display: flex; align-items: center; gap: 0.375rem; }
        .ciim-section-meter-track {
          width: 72px; height: 5px; background: rgba(255,255,255,0.3); border-radius: 3px; overflow: hidden;
        }
        .ciim-section-meter-fill {
          height: 100%; background: #fde68a; border-radius: 3px; transition: width 0.3s ease;
        }
        .ciim-section-meter-label { font-size: 0.6875rem; color: rgba(255,255,255,0.9); white-space: nowrap; }

        /* Manual Done button (no-task sections) */
        .ciim-manual-done-btn {
          display: flex; align-items: center; padding: 0.2rem 0.625rem;
          background: rgba(255,255,255,0.2); border: 1.5px solid rgba(255,255,255,0.5);
          border-radius: 9999px; cursor: pointer; color: #fff;
          font-size: 0.75rem; font-weight: 600; letter-spacing: 0.02em;
          transition: background 0.15s; white-space: nowrap;
        }
        .ciim-manual-done-btn:hover { background: rgba(255,255,255,0.35); }
        .ciim-manual-done-btn.is-done { background: rgba(255,255,255,0.25); }

        /* Icon buttons */
        .ciim-comment-btn, .ciim-print-btn {
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.15); border: 1.5px solid rgba(255,255,255,0.35);
          border-radius: 5px; cursor: pointer; color: #fff;
          width: 1.75rem; height: 1.75rem; padding: 0; transition: background 0.15s, border-color 0.15s;
        }
        .ciim-comment-btn:hover { background: rgba(255,255,255,0.3); border-color: #fff; }
        .ciim-comment-btn.has-comments { background: #f59e0b; border-color: #f59e0b; }
        .ciim-comment-btn sup { font-size: 0.55rem; margin-left: 1px; }
        .ciim-print-btn:hover { background: #1473e6; border-color: #1473e6; }

        /* ── Section content box ────────────────────────────── */
        .ciim-section-content {
          border: 1px solid #e5e7eb; border-top: none;
          border-radius: 0 0 6px 6px; padding: 1.25rem 1.5rem;
          background: #fff;
        }

        /* ── Comment modal ──────────────────────────────────── */
        .ciim-modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.4);
          display: flex; align-items: center; justify-content: center; z-index: 50;
        }
        .ciim-modal {
          background: #fff; border-radius: 10px; padding: 1.625rem;
          width: 100%; max-width: 480px; box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        }
        .ciim-modal-title { font-size: 1.0625rem; font-weight: 700; color: #1a1a1a; margin: 0 0 0.2rem; }
        .ciim-modal-section-name { font-size: 0.875rem; color: #6b7280; margin: 0 0 0.875rem; }
        .ciim-modal-textarea {
          width: 100%; border: 1px solid #d1d5db; border-radius: 6px;
          padding: 0.5rem 0.75rem; font-size: 0.9375rem; font-family: inherit;
          resize: vertical; outline: none; box-sizing: border-box;
        }
        .ciim-modal-textarea:focus { border-color: #C55A11; box-shadow: 0 0 0 3px rgba(197,90,17,0.12); }
        .ciim-modal-actions { display: flex; gap: 0.625rem; margin-top: 0.875rem; }
        .ciim-modal-save {
          background: #C55A11; color: #fff; border: none; border-radius: 6px;
          padding: 0.45rem 1.125rem; font-size: 0.9375rem; font-weight: 600;
          cursor: pointer; transition: background 0.15s;
        }
        .ciim-modal-save:hover:not(:disabled) { background: #a3470d; }
        .ciim-modal-save:disabled { opacity: 0.5; cursor: not-allowed; }
        .ciim-modal-cancel {
          background: none; border: 1px solid #d1d5db; border-radius: 6px;
          padding: 0.45rem 1.125rem; font-size: 0.9375rem; cursor: pointer; color: #374151;
        }
        .ciim-modal-cancel:hover { background: #f9fafb; }

        /* ── Copy-to-clipboard button ───────────────────────── */
        .ciim-copy-btn {
          display: inline-flex; align-items: center; justify-content: center;
          margin-left: 5px; padding: 2px 5px;
          border: 1px solid #d1d5db; border-radius: 4px;
          background: transparent; color: #9ca3af;
          cursor: pointer; vertical-align: middle; line-height: 1;
          transition: color 0.15s, border-color 0.15s, background 0.15s;
        }
        .ciim-copy-btn:hover { color: #374151; border-color: #9ca3af; background: #f9fafb; }
        .ciim-copy-btn.copied { color: #16a34a; border-color: #16a34a; background: #f0fdf4; }

        /* ── "Important" note highlight ─────────────────────── */
        .ciim-section-content p.note-important,
        .ciim-preamble p.note-important {
          background: #fffbeb;
          border-left: 3px solid #f59e0b;
          border-radius: 0 4px 4px 0;
          padding: 0.5rem 0.75rem 0.5rem 2.375rem;
          margin: 0.5rem 0 0.75rem;
          position: relative;
          line-height: 1.5;
        }
        .ciim-section-content p.note-important::before,
        .ciim-preamble p.note-important::before {
          content: "⚠";
          position: absolute; left: 0.625rem; top: 0.5rem;
          font-size: 0.9rem; color: #d97706; line-height: 1;
        }

        /* ── Word document color classes ─────────────────────── */
        /* Applied after re-upload; only affect text that had explicit color in .docx */
        .wc-c00000 { color: #C00000; }  /* Dark Red */
        .wc-ff0000 { color: #FF0000; }  /* Red */
        .wc-e26b0a { color: #E26B0A; }  /* Dark Orange */
        .wc-c55a11 { color: #C55A11; }  /* CARM Orange */
        .wc-ed7d31 { color: #ED7D31; }  /* Office Orange */
        .wc-ffc000 { color: #FFC000; }  /* Amber */
        .wc-0070c0 { color: #0070C0; }  /* Blue */
        .wc-4472c4 { color: #4472C4; }  /* Office Blue */
        .wc-00b0f0 { color: #00B0F0; }  /* Light Blue */
        .wc-17375e { color: #17375E; }  /* Navy */
        .wc-00b050 { color: #00B050; }  /* Green */
        .wc-70ad47 { color: #70AD47; }  /* Office Green */
        .wc-548235 { color: #548235; }  /* Dark Green */
        .wc-7030a0 { color: #7030A0; }  /* Purple */
        .wc-8b4726 { color: #8B4726; }  /* Dark Brown */
        .wc-595959 { color: #595959; }  /* Dark Gray */
        .wc-404040 { color: #404040; }  /* Charcoal */

        /* ── Responsive: hide summary on narrow viewports ── */
        @media (max-width: 1100px) {
          .ciim-summary-panel { display: none; }
        }

        /* ── Print ──────────────────────────────────────────── */
        @media print {
          .ciim-layout { display: block; }
          .ciim-toc { display: none; }
          .ciim-summary-panel { display: none; }
          .ciim-main { padding: 0; max-width: none; }
          @page { margin: 1in; }
          .ciim-section-bar { background: #8585a0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .ciim-section { margin: 0; page-break-inside: avoid; }
          .ciim-section-content h1 { page-break-before: always; }
          .ciim-section-content h1:first-of-type { page-break-before: avoid; }
          .ciim-section-content h2, .ciim-section-content h3 { page-break-after: avoid; }
          .ciim-section-content table { page-break-inside: avoid; }
          .ciim-print-hidden { display: none !important; }
          .ciim-missing { background: none !important; color: inherit !important; }
          .ciim-copy-btn { display: none !important; }
          .callout-it-box, .callout-info { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }

        /* ── Responsive: collapse sidebars on narrow viewports ── */
        @media (max-width: 768px) {
          .ciim-toc { display: none; }
          .ciim-summary-panel { display: none; }
          .ciim-main { padding: 1.25rem 1rem 2rem; }
        }
      `}</style>
    </>
  );
}
