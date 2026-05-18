"use client";

import { Button } from "@/components/ui/button";

export default function PrintButton() {
  return (
    <Button size="sm" onClick={() => window.print()}>
      Download PDF
    </Button>
  );
}
