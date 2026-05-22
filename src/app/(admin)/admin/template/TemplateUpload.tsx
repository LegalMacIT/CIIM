"use client";

import { useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";

type Props = {
  currentVersion: number | null;
};

export default function TemplateUpload({ currentVersion }: Props) {
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) return;

    setStatus("uploading");
    setMessage("");

    const body = new FormData();
    body.append("file", file);

    try {
      const res = await fetch("/api/admin/template-upload", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setStatus("success");
      setMessage(`Template v${json.version} uploaded and activated.`);
      if (inputRef.current) inputRef.current.value = "";
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      setStatus("error");
      setMessage(String(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">Current active template:</span>
        {currentVersion ? (
          <Badge variant="secondary">v{currentVersion}</Badge>
        ) : (
          <Badge variant="outline">None uploaded</Badge>
        )}
      </div>

      <form onSubmit={handleUpload} className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".docx"
          required
          className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-300 file:text-sm file:bg-white file:cursor-pointer"
        />
        <button
          type="submit"
          disabled={status === "uploading"}
          className="inline-flex items-center px-6 py-2.5 rounded-md text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-70"
          style={{
            background:
              status === "uploading" ? "#a3470d" :
              status === "success"   ? "#16a34a" :
              "#C55A11",
          }}
        >
          {status === "uploading" ? "Processing…" :
           status === "success"   ? "✓ Uploaded!" :
           "Upload & Activate"}
        </button>
      </form>

      {status === "error" && message && (
        <p className="text-sm text-red-600">{message}</p>
      )}

      <div className="mt-2 text-xs text-gray-400 space-y-1">
        <p>• Only .docx files are accepted.</p>
        <p>• The document will be converted to HTML and activated immediately.</p>
        <p>• The original .docx is saved to Supabase Storage for reference.</p>
      </div>
    </div>
  );
}
