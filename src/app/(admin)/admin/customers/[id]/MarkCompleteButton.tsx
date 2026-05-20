"use client";

import { useTransition } from "react";
import { markProjectComplete } from "@/app/actions/customers";

interface Props {
  customerId: string;
  status: string;
}

export default function MarkCompleteButton({ customerId, status }: Props) {
  const [isPending, startTransition] = useTransition();
  const isComplete = status === "complete";

  return (
    <button
      onClick={() => startTransition(() => markProjectComplete(customerId, !isComplete))}
      disabled={isPending}
      className="text-xs px-2.5 py-1 rounded-full font-semibold transition-colors disabled:opacity-50"
      style={
        isComplete
          ? { background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" }
          : { background: "#dcfce7", color: "#16a34a", border: "1px solid #bbf7d0" }
      }
    >
      {isPending ? "…" : isComplete ? "Mark Active" : "Mark Complete"}
    </button>
  );
}
