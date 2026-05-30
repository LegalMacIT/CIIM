import { createServiceClient } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CreateCustomerForm } from "./CreateCustomerForm";
import Link from "next/link";

export default async function AdminCustomersPage() {
  const supabase = createServiceClient();

  const [{ data: customersRaw }, { data: membersRaw }] = await Promise.all([
    supabase.from("customers").select("id, company_name, slug, status").order("company_name"),
    supabase.from("customer_members").select("customer_id"),
  ]);

  const customers = customersRaw as { id: string; company_name: string; slug: string; status: string }[] | null;
  const members = membersRaw as { customer_id: string }[] | null;
  const memberCountMap = new Map<string, number>();
  for (const m of members ?? []) {
    memberCountMap.set(m.customer_id, (memberCountMap.get(m.customer_id) ?? 0) + 1);
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage client accounts and their members.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            All Clients ({customers?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!customers?.length ? (
            <p className="text-sm text-gray-500">No clients yet.</p>
          ) : (
            <div className="divide-y">
              {customers.map((c) => {
                const count = memberCountMap.get(c.id) ?? 0;
                return (
                  <div key={c.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{c.company_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        slug: {c.slug} · {count} member{count !== 1 ? "s" : ""} ·{" "}
                        <span className={c.status === "complete" ? "text-green-600" : "text-orange-600"}>
                          {c.status}
                        </span>
                      </p>
                    </div>
                    <Link href={`/admin/customers/${c.id}`}>
                      <Button variant="outline" size="sm">Edit</Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add New Client</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateCustomerForm />
        </CardContent>
      </Card>
    </div>
  );
}
