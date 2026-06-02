"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { sendCalendarInvite } from "@/app/actions/calendar";

export default function SendInviteButton({
  disabled,
  adminCustomerId,
}: {
  disabled?: boolean;
  adminCustomerId?: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleClick = async () => {
    setState("sending");
    setErrorMsg("");
    const result = await sendCalendarInvite(adminCustomerId);
    if (result.error) {
      setErrorMsg(result.error);
      setState("error");
      setTimeout(() => setState("idle"), 4000);
    } else {
      setState("sent");
      setTimeout(() => setState("idle"), 3000);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={disabled || state === "sending"}
        title={disabled ? "Set Final Transition Date and Time first" : "Send calendar invitation to your email"}
      >
        {state === "sending" ? "Sending…" : state === "sent" ? "✓ Sent!" : state === "error" ? "Failed" : "Send Invitation"}
      </Button>
      {state === "error" && errorMsg && (
        <span className="text-xs text-red-600 max-w-48 text-right">{errorMsg}</span>
      )}
    </div>
  );
}
