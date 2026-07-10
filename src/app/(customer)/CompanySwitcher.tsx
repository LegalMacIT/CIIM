"use client";

import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setActiveCustomer } from "@/app/actions/active-customer";

type Company = { id: string; company_name: string };

export default function CompanySwitcher({
  companies,
  activeId,
}: {
  companies: Company[];
  activeId: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      value={activeId}
      onValueChange={(value) => {
        if (typeof value !== "string" || value === activeId) return;
        startTransition(() => {
          setActiveCustomer(value);
        });
      }}
      disabled={isPending}
    >
      <SelectTrigger size="sm" className="h-8 text-sm min-w-[180px]">
        <SelectValue placeholder="Select company">
          {(value: string) => companies.find((c) => c.id === value)?.company_name ?? "Select company"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {companies.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.company_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
