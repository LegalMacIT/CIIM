import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import { FIELD_GROUPS, BOOLEAN_KEYS, CREDENTIAL_KEYS, FIELD_WIDTH_CLASS, computeDerivedDefaults } from "@/lib/fields";
import { adminSaveFormValues } from "@/app/actions/customers";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import SaveConfigButton from "@/app/(customer)/dashboard/SaveConfigButton";
import UrlAutoFill from "@/app/(customer)/dashboard/UrlAutoFill";
import ClearCheckmarksButton from "@/app/(customer)/dashboard/ClearCheckmarksButton";
import SelectAllCheckmarksButton from "@/app/(customer)/dashboard/SelectAllCheckmarksButton";
import Link from "next/link";

export default async function AdminConfigurePage({
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

  const savedCredentials = new Set(
    (savedValues ?? [])
      .filter((r) => CREDENTIAL_KEYS.has(r.field_key) && r.field_value)
      .map((r) => r.field_key)
  );

  const nonBooleanFields = FIELD_GROUPS.flatMap((g) =>
    g.fields.filter((f) => f.type !== "boolean")
  );
  const filledCount = nonBooleanFields.filter((f) => values[f.key]).length;
  const fillPercent = Math.round((filledCount / nonBooleanFields.length) * 100);

  const derivedValues = computeDerivedDefaults(values);
  const saveForCustomer = adminSaveFormValues.bind(null, id);

  return (
    <div className="p-8">
      <style>{`
        .ciim-dash { font-family: var(--font-sans), "Source Sans 3", sans-serif; }
        .ciim-dash input:focus, .ciim-dash input:focus-visible {
          outline: none !important; border-color: #C55A11 !important;
          box-shadow: 0 0 0 3px rgba(197,90,17,0.12) !important;
        }
        .ciim-dash [data-slot="checkbox"][data-state="checked"] {
          background-color: #C55A11 !important; border-color: #C55A11 !important;
        }
        .ciim-dash-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
        .ciim-dash-card-header {
          padding: 1rem 1.25rem 0.75rem; border-left: 4px solid #C55A11;
          background: #fafafa; border-bottom: 1px solid #f3f4f6;
        }
        .ciim-dash-card-header h2 { font-size: 0.9375rem; font-weight: 700; color: #1a1a1a; margin: 0 0 0.125rem; }
        .ciim-dash-card-header p { font-size: 0.8125rem; color: #6b7280; margin: 0; }
        .ciim-dash-card-body { padding: 1.25rem; }
        .ciim-dash-label { display: block; font-size: 0.8125rem; font-weight: 600; color: #374151; margin-bottom: 0.3rem; }
        .ciim-dash-hint { font-size: 0.75rem; color: #9ca3af; margin-top: 0.25rem; }
        .ciim-dash-bool-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.5rem; }
        .ciim-dash-bool-item {
          display: flex; align-items: center; gap: 0.5rem; padding: 0.45rem 0.625rem;
          border-radius: 6px; background: #f9fafb; border: 1px solid #f3f4f6; cursor: pointer;
        }
        .ciim-dash-bool-item:has(input:checked) { background: #fff7f0; border-color: #fed7aa; }
        .ciim-dash-bool-label { font-size: 0.8125rem; color: #374151; cursor: pointer; user-select: none; }
        .ciim-dash-fill-bar { height: 5px; background: #e5e7eb; border-radius: 3px; overflow: hidden; margin-top: 0.5rem; }
        .ciim-dash-fill-fill { height: 100%; background: #C55A11; border-radius: 3px; transition: width 0.3s; }
      `}</style>

      <div className="ciim-dash" style={{ maxWidth: "860px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div className="mb-6">
          <Link href={`/admin/customers/${id}`} className="text-sm text-gray-500 hover:text-gray-900">
            ← {customer.company_name}
          </Link>
          <h1 className="text-2xl font-bold mt-2" style={{ color: "#C55A11" }}>
            Configuration — {customer.company_name}
          </h1>
          <div className="ciim-dash-fill-bar w-48 mt-2">
            <div className="ciim-dash-fill-fill" style={{ width: `${fillPercent}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-1">{filledCount} of {nonBooleanFields.length} fields filled</p>
        </div>

        <form action={saveForCustomer} className="space-y-5">
          {FIELD_GROUPS.map((group, gi) => (
            <div key={gi} className="ciim-dash-card">
              <div className="ciim-dash-card-header flex items-start justify-between gap-3">
                <div>
                  <h2>{group.title}</h2>
                  {group.description && <p>{group.description}</p>}
                </div>
                {group.fields[0].type === "boolean" && (
                  <div className="flex flex-col items-end gap-1">
                    <ClearCheckmarksButton fieldKeys={group.fields.map((f) => f.key)} idPrefix="f-" />
                    <SelectAllCheckmarksButton fieldKeys={group.fields.map((f) => f.key)} idPrefix="f-" />
                  </div>
                )}
              </div>
              <div className="ciim-dash-card-body">
                {group.fields[0].type === "boolean" ? (
                  <div className="ciim-dash-bool-grid">
                    {group.fields.map((field) => (
                      <label key={field.key} className="ciim-dash-bool-item" htmlFor={`f-${field.key}`}>
                        <Checkbox
                          key={`${field.key}:${values[field.key] !== ""}`}
                          id={`f-${field.key}`}
                          name={field.key}
                          defaultChecked={values[field.key] !== ""}
                        />
                        <span className="ciim-dash-bool-label">{field.label}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-6 gap-4">
                    {group.fields.map((field) => {
                      const isCredential = CREDENTIAL_KEYS.has(field.key);
                      const hasSavedCredential = savedCredentials.has(field.key);
                      return (
                        <div key={field.key} className={FIELD_WIDTH_CLASS[field.width ?? "full"]}>
                          <div className="flex items-center gap-2 mb-1">
                            <label className="ciim-dash-label" htmlFor={`f-${field.key}`}>
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
                            key={`${field.key}:${isCredential ? "" : (values[field.key] || derivedValues[field.key] || "")}`}
                            id={`f-${field.key}`}
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
                          {field.hint && <p className="ciim-dash-hint">{field.hint}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}

          <div className="flex justify-end items-center gap-3 pt-2">
            <SaveConfigButton />
            <Link
              href={`/admin/customers/${id}/manual`}
              className="inline-flex items-center px-5 py-2.5 rounded-md text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              View Manual →
            </Link>
          </div>
        </form>
        <UrlAutoFill idPrefix="f-" />
      </div>
    </div>
  );
}
