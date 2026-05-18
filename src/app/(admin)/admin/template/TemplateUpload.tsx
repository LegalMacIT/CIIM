"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
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
        <Button type="submit" disabled={status === "uploading"}>
          {status === "uploading" ? "Processing…" : "Upload & Activate"}
        </Button>
      </form>

      {message && (
        <p className={`text-sm ${status === "error" ? "text-red-600" : "text-green-700"}`}>
          {message}
        </p>
      )}

      <div className="mt-2 text-xs text-gray-400 space-y-1">
        <p>• Only .docx files are accepted.</p>
        <p>• The document will be converted to HTML and activated immediately.</p>
        <p>• The original .docx is saved to Supabase Storage for reference.</p>
        <p>
          • Fix these 4 merge fields in Word before uploading:{" "}
          <code className="bg-gray-100 px-1 rounded">&ldquo;cim_url&rdquo;</code>,{" "}
          <code className="bg-gray-100 px-1 rounded">&ldquo;final_trans_date&rdquo;</code>,{" "}
          <code className="bg-gray-100 px-1 rounded">&ldquo;final_trans_hour&rdquo;</code>,{" "}
          <code className="bg-gray-100 px-1 rounded">&ldquo;final_timezone&rdquo;</code>{" "}
          — the extra quotes around the field names prevent them from merging.
        </p>
      </div>
    </div>
  );
}
