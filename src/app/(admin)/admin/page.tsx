import { clerkClient } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase";
import { FIELD_GROUPS, CREDENTIAL_KEYS, BOOLEAN_KEYS } from "@/lib/fields";
import Link from "next/link";
import MarkCompleteButton from "./customers/[id]/MarkCompleteButton";

const nonBooleanTotal = FIELD_GROUPS.flatMap((g) =>
  g.fields.filter((f) => f.type !== "boolean" && !CREDENTIAL_KEYS.has(f.key))
).length;

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function AdminDashboardPage() {
  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [
    { data: customersRaw },
    { data: allFormValuesRaw },
    { data: membersRaw },
    { data: taskRowsRaw },
  ] = await Promise.all([
    db.from("customers").select("id, company_name, slug, status").order("company_name"),
    supabase.from("form_values").select("customer_id, field_key, field_value, updated_at"),
    db.from("customer_members").select("customer_id, clerk_user_id"),
    supabase.from("task_completions").select("customer_id"),
  ]);

  const customers = customersRaw as { id: string; company_name: string; slug: string; status: string }[] | null;
  const allFormValues = allFormValuesRaw as { customer_id: string; field_key: string; field_value: string | null; updated_at: string | null }[] | null;
  const members = membersRaw as { customer_id: string; clerk_user_id: string }[] | null;
  const taskRows = taskRowsRaw as { customer_id: string }[] | null;

  // Build lookup maps
  const lastEditMap = new Map<string, Date>();
  const progressMap = new Map<string, { filled: number }>();

  for (const row of allFormValues ?? []) {
    if (row.updated_at) {
      const d = new Date(row.updated_at);
      const prev = lastEditMap.get(row.customer_id);
      if (!prev || d > prev) lastEditMap.set(row.customer_id, d);
    }
    if (
      row.field_value &&
      !BOOLEAN_KEYS.has(row.field_key) &&
      !CREDENTIAL_KEYS.has(row.field_key)
    ) {
      const prev = progressMap.get(row.customer_id) ?? { filled: 0 };
      progressMap.set(row.customer_id, { filled: prev.filled + 1 });
    }
  }

  const taskCountMap = new Map<string, number>();
  for (const row of taskRows ?? []) {
    taskCountMap.set(row.customer_id, (taskCountMap.get(row.customer_id) ?? 0) + 1);
  }

  const memberMap = new Map<string, string[]>();
  for (const m of members ?? []) {
    const arr = memberMap.get(m.customer_id) ?? [];
    arr.push(m.clerk_user_id);
    memberMap.set(m.customer_id, arr);
  }

  const allClerkIds = (members ?? []).map((m) => m.clerk_user_id);
  const lastLoginMap = new Map<string, Date>();

  if (allClerkIds.length > 0) {
    try {
      const clerk = await clerkClient();
      const { data: clerkUsers } = await clerk.users.getUserList({
        userId: allClerkIds,
        limit: 200,
      });
      const loginByClerkId = new Map<string, number>();
      for (const u of clerkUsers) {
        if (u.lastSignInAt) loginByClerkId.set(u.id, u.lastSignInAt);
      }
      for (const [custId, ids] of memberMap.entries()) {
        let max: number | null = null;
        for (const cid of ids) {
          const t = loginByClerkId.get(cid);
          if (t && (!max || t > max)) max = t;
        }
        if (max) lastLoginMap.set(custId, new Date(max));
      }
    } catch {
      // Clerk unavailable — last login will show "—"
    }
  }

  return (
    <div style={{ maxWidth: "1100px" }}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          {customers?.length ?? 0} client{(customers?.length ?? 0) !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafafa", borderBottom: "1px solid #e5e7eb" }}>
              {["Company", "Last Edit", "Last Login", "Progress", "Tasks", "Status", "Actions"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "0.625rem 1rem",
                    textAlign: "left",
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#6b7280",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(customers ?? []).map((c) => {
              const filled = progressMap.get(c.id)?.filled ?? 0;
              const pct = Math.round((filled / nonBooleanTotal) * 100);
              const lastEdit = lastEditMap.get(c.id) ?? null;
              const lastLogin = lastLoginMap.get(c.id) ?? null;
              const taskCount = taskCountMap.get(c.id) ?? 0;
              const isComplete = c.status === "complete";
              const memberCount = memberMap.get(c.id)?.length ?? 0;

              return (
                <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <Link
                      href={`/admin/customers/${c.id}`}
                      className="font-medium text-sm text-gray-900 hover:text-orange-700"
                    >
                      {c.company_name}
                    </Link>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {memberCount} member{memberCount !== 1 ? "s" : ""}
                    </p>
                  </td>

                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.8125rem", color: "#6b7280", whiteSpace: "nowrap" }}>
                    {formatDate(lastEdit)}
                  </td>

                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.8125rem", color: "#6b7280", whiteSpace: "nowrap" }}>
                    {formatDate(lastLogin)}
                  </td>

                  <td style={{ padding: "0.75rem 1rem", minWidth: "130px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ flex: 1, height: "6px", background: "#e5e7eb", borderRadius: "3px", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${pct}%`,
                            background: pct === 100 ? "#16a34a" : "#C55A11",
                            borderRadius: "3px",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: "0.75rem", color: "#6b7280", whiteSpace: "nowrap" }}>
                        {filled}/{nonBooleanTotal}
                      </span>
                    </div>
                  </td>

                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.8125rem", color: "#6b7280", textAlign: "center" }}>
                    {taskCount}
                  </td>

                  <td style={{ padding: "0.75rem 1rem" }}>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        padding: "0.2rem 0.625rem",
                        borderRadius: "9999px",
                        background: isComplete ? "#f0fdf4" : "#fff7f0",
                        color: isComplete ? "#16a34a" : "#C55A11",
                        border: `1px solid ${isComplete ? "#bbf7d0" : "#fed7aa"}`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isComplete ? "Complete" : "Active"}
                    </span>
                  </td>

                  <td style={{ padding: "0.75rem 1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Link
                        href={`/admin/customers/${c.id}/configure`}
                        className="text-xs px-2.5 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium whitespace-nowrap"
                      >
                        Config
                      </Link>
                      <Link
                        href={`/admin/customers/${c.id}/manual`}
                        className="text-xs px-2.5 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium whitespace-nowrap"
                      >
                        Manual
                      </Link>
                      <MarkCompleteButton customerId={c.id} status={c.status} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {!customers?.length && (
              <tr>
                <td colSpan={7} style={{ padding: "2rem 1rem", textAlign: "center", color: "#9ca3af", fontSize: "0.875rem" }}>
                  No clients yet.{" "}
                  <Link href="/admin/customers" className="text-orange-700 underline">Add one</Link>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
