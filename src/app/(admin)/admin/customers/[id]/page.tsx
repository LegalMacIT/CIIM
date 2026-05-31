import { createServiceClient } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { deleteCustomer } from "@/app/actions/customers";
import { EditCustomerForm } from "./EditCustomerForm";
import MemberManager from "./MemberManager";
import Link from "next/link";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServiceClient();

  const [{ data: customer }, { data: membersRaw }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("customer_members").select("clerk_user_id, joined_at").eq("customer_id", id).order("joined_at" as never),
  ]);

  const members = membersRaw as unknown as { clerk_user_id: string; joined_at: string }[] | null;

  if (!customer) notFound();

  const deleteWithId = deleteCustomer.bind(null, id);

  return (
    <div className="max-w-xl space-y-6 p-8">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/admin/customers">
          <Button variant="ghost" size="sm">← Back</Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex-1">{customer.company_name}</h1>
        <div className="flex gap-2">
          <Link href={`/admin/customers/${id}/configure`}>
            <Button variant="outline" size="sm">Config</Button>
          </Link>
          <Link href={`/admin/customers/${id}/manual`}>
            <Button variant="outline" size="sm">Manual</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company Details</CardTitle>
        </CardHeader>
        <CardContent>
          <EditCustomerForm
            id={id}
            defaultValues={{
              company_name: customer.company_name,
              slug: customer.slug,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members</CardTitle>
        </CardHeader>
        <CardContent>
          <MemberManager customerId={id} members={members ?? []} />
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-base text-red-700">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Deleting this client will permanently remove all their form values.
          </p>
          <form action={deleteWithId}>
            <Button type="submit" variant="destructive" size="sm">
              Delete Client
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
