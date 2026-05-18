"use client";

export default function DashboardPrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-opacity hover:opacity-80"
      style={{ border: "1.5px solid #C55A11", color: "#C55A11", background: "#fff" }}
    >
      Print Configuration
    </button>
  );
}
