"use client";

import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DeployStatus } from "@/lib/deploy-status";

const RECHECK_MS = 20_000;

export default function DeployStatusCard({ status }: { status: DeployStatus }) {
  // While a deploy is running, reload the page so it picks up the new build
  // as soon as Vercel switches over. Full reload (not router.refresh) so the
  // browser fetches the new build's assets too.
  useEffect(() => {
    if (status.kind !== "deploying") return;
    const t = setTimeout(() => window.location.reload(), RECHECK_MS);
    return () => clearTimeout(t);
  }, [status.kind]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">App Deployment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {status.kind === "local" && (
          <p className="text-gray-500">Local development build — deployment status is shown on Vercel only.</p>
        )}

        {status.kind === "live" && (
          <p className={status.latestChecked ? "text-green-700 font-medium" : "text-gray-700"}>
            {status.latestChecked
              ? "✓ Up to date — the latest commit on main is live."
              : "Live build shown below (couldn’t reach GitHub to compare with main)."}
          </p>
        )}

        {status.kind === "deploying" && (
          <p className="text-gray-700">
            <span className="font-medium">Deploying</span> <Commit sha={status.pending.sha} /> —{" "}
            {status.pending.message}
            {status.since && <span className="text-gray-500"> (started {time(status.since)})</span>}
            <span className="block text-xs text-gray-500 mt-1">
              This page rechecks every {RECHECK_MS / 1000} seconds.
            </span>
          </p>
        )}

        {status.kind === "failed" && (
          <p className="text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            Deploy of <Commit sha={status.pending.sha} /> failed — {status.pending.message}.
            {status.logUrl && (
              <>
                {" "}
                <a href={status.logUrl} target="_blank" rel="noreferrer" className="underline">
                  View on Vercel
                </a>
              </>
            )}
          </p>
        )}

        {status.kind !== "local" && (
          <p className="text-xs text-gray-500">
            Live build: <Commit sha={status.live.sha} /> — {status.live.message}
            {status.live.builtAt && <> · built {time(status.live.builtAt)}</>}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Commit({ sha }: { sha: string }) {
  return <code className="font-mono text-xs bg-gray-100 rounded px-1">{sha.slice(0, 7)}</code>;
}

function time(iso: string) {
  return new Date(iso).toLocaleString();
}
