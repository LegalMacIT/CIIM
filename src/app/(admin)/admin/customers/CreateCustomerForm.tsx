"use client";

import { useActionState } from "react";
import { createCustomer } from "@/app/actions/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateCustomerForm() {
  const [state, action, isPending] = useActionState(createCustomer, null);

  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {state.error}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="company_name">Company Name</Label>
          <Input id="company_name" name="company_name" required placeholder="Acme Law LLP" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" name="slug" required placeholder="acme-law" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="clerk_user_id">Clerk User ID</Label>
        <Input
          id="clerk_user_id"
          name="clerk_user_id"
          required
          placeholder="user_2abc..."
          className="font-mono text-sm"
        />
        <p className="text-xs text-gray-500">
          Found in the Clerk dashboard under the customer&apos;s user record.
        </p>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "Create Customer"}
      </Button>
    </form>
  );
}
