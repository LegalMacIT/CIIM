"use client";

import { useActionState } from "react";
import { updateCustomer } from "@/app/actions/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

interface Props {
  id: string;
  defaultValues: {
    company_name: string;
    slug: string;
  };
}

export function EditCustomerForm({ id, defaultValues }: Props) {
  const updateWithId = updateCustomer.bind(null, id);
  const [state, action, isPending] = useActionState(updateWithId, null);

  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {state.error}
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="company_name">Company Name</Label>
        <Input
          id="company_name"
          name="company_name"
          defaultValue={defaultValues.company_name}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="slug">Slug</Label>
        <Input id="slug" name="slug" defaultValue={defaultValues.slug} required />
      </div>
      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save Changes"}
        </Button>
        <Link href="/admin/customers">
          <Button type="button" variant="outline">Cancel</Button>
        </Link>
      </div>
    </form>
  );
}
