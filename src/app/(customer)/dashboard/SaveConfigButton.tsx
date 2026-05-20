"use client";

import { useFormStatus } from "react-dom";
import { useEffect, useState } from "react";

export default function SaveConfigButton() {
  const { pending } = useFormStatus();
  const [saved, setSaved] = useState(false);
  const [wasPending, setWasPending] = useState(false);

  useEffect(() => {
    if (pending) {
      setWasPending(true);
    } else if (wasPending) {
      setWasPending(false);
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(t);
    }
  }, [pending, wasPending]);

  let label = "Save Configuration";
  let bg = "#C55A11";
  if (pending) { label = "Saving…"; bg = "#a3470d"; }
  else if (saved) { label = "✓ Saved!"; bg = "#16a34a"; }

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center px-6 py-2.5 rounded-md text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-70"
      style={{ background: bg }}
    >
      {label}
    </button>
  );
}
