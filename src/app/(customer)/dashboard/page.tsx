import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import { FIELD_GROUPS, BOOLEAN_KEYS, CREDENTIAL_KEYS, computeDerivedDefaults } from "@/lib/fields";
import { saveFormValues } from "@/app/actions/form-values";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import DashboardPrintButton from "./DashboardPrintButton";

export default async function DashboardPage() {
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

  if (!customer) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Account not configured</h1>
        <p className="text-gray-500 text-sm">
          Your account hasn&apos;t been linked to a customer record yet. Please contact CARM Consulting.
        </p>
      </div>
    );
  }

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

  const savedCredentials = new Set(
    (savedValues ?? [])
      .filter((r) => CREDENTIAL_KEYS.has(r.field_key) && r.field_value)
      .map((r) => r.field_key)
  );

  const derivedValues = computeDerivedDefaults(values);

  // Count filled non-boolean fields for the completion indicator
  const nonBooleanFields = FIELD_GROUPS.flatMap((g) =>
    g.fields.filter((f) => f.type !== "boolean")
  );
  const filledCount = nonBooleanFields.filter((f) => values[f.key]).length;
  const fillPercent = Math.round((filledCount / nonBooleanFields.length) * 100);

  // Boolean sections: enabled if NOT explicitly set to "" (undefined = default on)
  const booleanGroup = FIELD_GROUPS.find((g) => g.fields[0]?.type === "boolean");

  return (
    <>
      <style>{`
        .ciim-dash { font-family: var(--font-sans), "Source Sans 3", sans-serif; }
        .ciim-dash input:focus, .ciim-dash input:focus-visible {
          outline: none !important;
          border-color: #C55A11 !important;
          box-shadow: 0 0 0 3px rgba(197,90,17,0.12) !important;
        }
        .ciim-dash [data-slot="checkbox"][data-state="checked"] {
          background-color: #C55A11 !important;
          border-color: #C55A11 !important;
        }
        .ciim-dash-card {
          background: #fff; border: 1px solid #e5e7eb; border-radius: 8px;
          overflow: hidden;
        }
        .ciim-dash-card-header {
          padding: 1rem 1.25rem 0.75rem;
          border-left: 4px solid #C55A11;
          background: #fafafa; border-bottom: 1px solid #f3f4f6;
        }
        .ciim-dash-card-header h2 {
          font-size: 0.9375rem; font-weight: 700; color: #1a1a1a; margin: 0 0 0.125rem;
        }
        .ciim-dash-card-header p {
          font-size: 0.8125rem; color: #6b7280; margin: 0;
        }
        .ciim-dash-card-body { padding: 1.25rem; }
        .ciim-dash-label {
          display: block; font-size: 0.8125rem; font-weight: 600;
          color: #374151; margin-bottom: 0.3rem;
        }
        .ciim-dash-hint { font-size: 0.75rem; color: #9ca3af; margin-top: 0.25rem; }
        .ciim-dash-bool-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.5rem;
        }
        .ciim-dash-bool-item {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.45rem 0.625rem; border-radius: 6px; background: #f9fafb;
          border: 1px solid #f3f4f6; cursor: pointer;
          transition: background 0.12s, border-color 0.12s;
        }
        .ciim-dash-bool-item:has(input:checked) {
          background: #fff7f0; border-color: #fed7aa;
        }
        .ciim-dash-bool-label {
          font-size: 0.8125rem; color: #374151; cursor: pointer; user-select: none;
        }
        .ciim-dash-fill-bar {
          height: 5px; background: #e5e7eb; border-radius: 3px; overflow: hidden; margin-top: 0.5rem;
        }
        .ciim-dash-fill-fill {
          height: 100%; background: #C55A11; border-radius: 3px; transition: width 0.3s;
        }

        /* ── Summary panel ── */
        .ciim-dash-summary {
          background: #fff; border: 1px solid #e5e7eb; border-radius: 8px;
          overflow: hidden; position: sticky; top: 4rem; max-height: calc(100vh - 5rem);
          overflow-y: auto;
        }
        .ciim-dash-summary-header {
          background: #1a1a1a; color: #fff;
          padding: 0.625rem 1rem; font-size: 0.6875rem; font-weight: 700;
          letter-spacing: 0.07em; text-transform: uppercase; position: sticky; top: 0;
        }
        .ciim-dash-summary-section {
          border-bottom: 1px solid #f3f4f6; padding: 0.625rem 1rem;
        }
        .ciim-dash-summary-section:last-child { border-bottom: none; }
        .ciim-dash-summary-group-title {
          font-size: 0.625rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.07em; color: #C55A11; margin-bottom: 0.4rem;
        }
        .ciim-dash-summary-row {
          display: flex; justify-content: space-between; align-items: baseline;
          gap: 0.375rem; margin-bottom: 0.2rem;
        }
        .ciim-dash-summary-key {
          font-size: 0.75rem; color: #6b7280; flex-shrink: 0;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 48%;
        }
        .ciim-dash-summary-val {
          font-size: 0.75rem; color: #1a1a1a; font-weight: 500;
          text-align: right; white-space: nowrap; overflow: hidden;
          text-overflow: ellipsis; max-width: 52%;
        }
        .ciim-dash-summary-val--empty { color: #d1d5db; font-style: italic; }
        .ciim-dash-summary-val--saved { color: #16a34a; }
        .ciim-dash-bool-on {
          font-size: 0.75rem; color: #16a34a; margin-bottom: 0.15rem;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ciim-dash-bool-off {
          font-size: 0.75rem; color: #d1d5db; margin-bottom: 0.15rem;
          text-decoration: line-through;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        /* ── Print ── */
        @media print {
          .ciim-dash-summary { position: static; max-height: none; overflow: visible; }
          .ciim-dash input { border: none !important; box-shadow: none !important; background: transparent !important; }
          .ciim-dash button[type="submit"] { display: none !important; }
        }
      `}</style>

      <div className="ciim-dash" style={{ maxWidth: "1160px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        {/* ── Page header ── */}
        <div className="mb-7 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#C55A11" }}>
              Migration Configuration
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">{customer.company_name}</p>
            <div className="ciim-dash-fill-bar w-48 mt-2">
              <div className="ciim-dash-fill-fill" style={{ width: `${fillPercent}%` }} />
            </div>
            <p className="text-xs text-gray-400 mt-1">{filledCount} of {nonBooleanFields.length} fields filled</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <DashboardPrintButton />
            <Link
              href="/manual"
              style={{ background: "#C55A11", color: "#fff" }}
              className="print:hidden inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
            >
              View My Manual →
            </Link>
          </div>
        </div>

        {/* ── Two-column: form + summary ── */}
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>

          {/* ── Left: form ── */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <form action={saveFormValues} className="space-y-5">
              {FIELD_GROUPS.map((group, gi) => (
                <div key={gi} className="ciim-dash-card">
                  <div className="ciim-dash-card-header">
                    <h2>{group.title}</h2>
                    {group.description && <p>{group.description}</p>}
                  </div>
                  <div className="ciim-dash-card-body">
                    {group.fields[0].type === "boolean" ? (
                      <div className="ciim-dash-bool-grid">
                        {group.fields.map((field) => (
                          <label key={field.key} className="ciim-dash-bool-item" htmlFor={field.key}>
                            <Checkbox
                              id={field.key}
                              name={field.key}
                              defaultChecked={values[field.key] !== ""}
                            />
                            <span className="ciim-dash-bool-label">{field.label}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {group.fields.map((field) => {
                          const isCredential = CREDENTIAL_KEYS.has(field.key);
                          const hasSavedCredential = savedCredentials.has(field.key);
                          return (
                            <div key={field.key}>
                              <div className="flex items-center gap-2 mb-1">
                                <label className="ciim-dash-label" htmlFor={field.key}>
                                  {field.label}
                                </label>
                                {isCredential && (
                                  <Badge variant="secondary" className="text-xs">Encrypted</Badge>
                                )}
                                {isCredential && hasSavedCredential && (
                                  <Badge variant="outline" className="text-xs text-green-700 border-green-300">
                                    Saved
                                  </Badge>
                                )}
                              </div>
                              <Input
                                id={field.key}
                                name={field.key}
                                type={
                                  field.type === "password" ? "password"
                                    : field.type === "date" ? "date"
                                    : field.type === "time" ? "time"
                                    : field.type === "email" ? "email"
                                    : field.type === "url" ? "url"
                                    : "text"
                                }
                                placeholder={isCredential && hasSavedCredential ? "••••••••" : (field.placeholder ?? "")}
                                defaultValue={isCredential ? "" : (values[field.key] || derivedValues[field.key] || "")}
                                autoComplete={field.type === "password" ? "new-password" : undefined}
                              />
                              {field.hint && (
                                <p className="ciim-dash-hint">{field.hint}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="inline-flex items-center px-6 py-2.5 rounded-md text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
                  style={{ background: "#C55A11" }}
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </div>

          {/* ── Right: summary panel ── */}
          <div style={{ width: "256px", flexShrink: 0 }}>
            <div className="ciim-dash-summary">
              <div className="ciim-dash-summary-header">Configuration Summary</div>

              {FIELD_GROUPS.filter((g) => g.fields[0]?.type !== "boolean").map((group, gi) => {
                const textFields = group.fields.filter((f) => !CREDENTIAL_KEYS.has(f.key));
                const credFields = group.fields.filter((f) => CREDENTIAL_KEYS.has(f.key));
                return (
                  <div key={gi} className="ciim-dash-summary-section">
                    <div className="ciim-dash-summary-group-title">{group.title}</div>
                    {textFields.map((field) => {
                      const val = values[field.key];
                      return (
                        <div key={field.key} className="ciim-dash-summary-row">
                          <span className="ciim-dash-summary-key" title={field.label}>{field.label}</span>
                          <span
                            className={`ciim-dash-summary-val${val ? "" : " ciim-dash-summary-val--empty"}`}
                            title={val || "not set"}
                          >
                            {val || "—"}
                          </span>
                        </div>
                      );
                    })}
                    {credFields.map((field) => (
                      <div key={field.key} className="ciim-dash-summary-row">
                        <span className="ciim-dash-summary-key" title={field.label}>{field.label}</span>
                        <span
                          className={`ciim-dash-summary-val${savedCredentials.has(field.key) ? " ciim-dash-summary-val--saved" : " ciim-dash-summary-val--empty"}`}
                        >
                          {savedCredentials.has(field.key) ? "Saved" : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Boolean section toggles */}
              {booleanGroup && (
                <div className="ciim-dash-summary-section">
                  <div className="ciim-dash-summary-group-title">Manual Sections</div>
                  {booleanGroup.fields.map((field) => {
                    const isOn = values[field.key] !== "";
                    return (
                      <div key={field.key} className={isOn ? "ciim-dash-bool-on" : "ciim-dash-bool-off"} title={field.label}>
                        {isOn ? "✓ " : "○ "}{field.label}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
