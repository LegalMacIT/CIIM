"use client";

import { useActionState } from "react";
import { addMember, removeMember } from "@/app/actions/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Member {
  clerk_user_id: string;
  joined_at: string;
  name?: string | null;
}

interface Props {
  customerId: string;
  members: Member[];
}

export default function MemberManager({ customerId, members }: Props) {
  const [state, action, isPending] = useActionState(addMember, null);

  return (
    <div className="space-y-4">
      {members.length === 0 ? (
        <p className="text-sm text-gray-500">No members yet.</p>
      ) : (
        <div className="divide-y">
          {members.map((m) => {
            const removeAction = removeMember.bind(null, customerId, m.clerk_user_id);
            return (
              <div key={m.clerk_user_id} className="py-2.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm">{m.name || "Unknown user"}</p>
                  <p className="text-xs font-mono text-gray-400 mt-0.5">{m.clerk_user_id}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Added {new Date(m.joined_at).toLocaleDateString()}
                  </p>
                </div>
                <form action={removeAction}>
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </Button>
                </form>
              </div>
            );
          })}
        </div>
      )}

      <form action={action} className="flex gap-2 pt-2">
        <input type="hidden" name="customer_id" value={customerId} />
        <Input
          name="clerk_user_id"
          placeholder="user_2abc..."
          className="font-mono text-sm"
          required
        />
        <Button type="submit" disabled={isPending} size="sm">
          {isPending ? "Adding…" : "Add"}
        </Button>
      </form>
      {state?.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
    </div>
  );
}
