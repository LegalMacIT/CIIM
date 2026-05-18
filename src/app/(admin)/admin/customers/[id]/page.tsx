import { createServiceClient } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { deleteCustomer } from "@/app/actions/customers";
import { EditCustomerForm } from "./EditCustomerForm";
import Link from "next/link";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();

  if (!customer) notFound();

  const deleteWithId = deleteCustomer.bind(null, id);

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/customers">
          <Button variant="ghost" size="sm">← Back</Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit Customer</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{customer.company_name}</CardTitle>
        </CardHeader>
        <CardContent>
          <EditCustomerForm
            id={id}
            defaultValues={{
              company_name: customer.company_name,
              slug: customer.slug,
              clerk_user_id: customer.clerk_user_id,
            }}
          />
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-base text-red-700">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Deleting this customer will permanently remove all their form values.
          </p>
          <form action={deleteWithId}>
            <Button type="submit" variant="destructive" size="sm">
              Delete Customer
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
