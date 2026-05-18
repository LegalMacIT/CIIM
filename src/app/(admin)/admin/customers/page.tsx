import { createServiceClient } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CreateCustomerForm } from "./CreateCustomerForm";
import Link from "next/link";

export default async function AdminCustomersPage() {
  const supabase = createServiceClient();

  const { data: customers } = await supabase
    .from("customers")
    .select("id, company_name, slug, clerk_user_id, created_at")
    .order("company_name");

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage customer accounts and their Clerk user IDs.
        </p>
      </div>

      {/* Customer list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            All Customers ({customers?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!customers?.length ? (
            <p className="text-sm text-gray-500">No customers yet.</p>
          ) : (
            <div className="divide-y">
              {customers.map((c) => (
                <div key={c.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{c.company_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      slug: {c.slug} · clerk: {c.clerk_user_id}
                    </p>
                  </div>
                  <Link href={`/admin/customers/${c.id}`}>
                    <Button variant="outline" size="sm">Edit</Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Create new customer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add New Customer</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateCustomerForm />
        </CardContent>
      </Card>
    </div>
  );
}
