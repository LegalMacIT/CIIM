// Compares the commit this build was made from (stamped in next.config.ts)
// with the latest commit on main, using GitHub's public read-only API and the
// deployment records Vercel posts there. No tokens; any failure degrades to
// showing just the live build.

export type DeployStatus =
  | { kind: "local" }
  | { kind: "live"; live: BuildInfo; latestChecked: boolean }
  | { kind: "deploying"; live: BuildInfo; pending: CommitInfo; since: string | null }
  | { kind: "failed"; live: BuildInfo; pending: CommitInfo; logUrl: string | null };

type CommitInfo = { sha: string; message: string };
type BuildInfo = CommitInfo & { builtAt: string };

const GITHUB = "https://api.github.com/repos";

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function getDeployStatus(): Promise<DeployStatus> {
  const sha = process.env.BUILD_COMMIT_SHA;
  const repo = process.env.BUILD_REPO;
  if (!sha || !repo) return { kind: "local" };

  const live: BuildInfo = {
    sha,
    message: firstLine(process.env.BUILD_COMMIT_MESSAGE ?? ""),
    builtAt: process.env.BUILD_TIME ?? "",
  };

  const head = await getJson<{ sha: string; commit: { message: string } }>(
    `${GITHUB}/${repo}/commits/main`
  );
  if (!head) return { kind: "live", live, latestChecked: false };
  if (head.sha === sha) return { kind: "live", live, latestChecked: true };

  const pending: CommitInfo = { sha: head.sha, message: firstLine(head.commit.message) };

  const deployments = await getJson<{ statuses_url: string; created_at: string }[]>(
    `${GITHUB}/${repo}/deployments?sha=${head.sha}&environment=Production&per_page=1`
  );
  const deployment = deployments?.[0];
  if (!deployment) return { kind: "deploying", live, pending, since: null };

  const statuses = await getJson<{ state: string; target_url: string | null }[]>(
    `${deployment.statuses_url}?per_page=1`
  );
  const state = statuses?.[0]?.state;
  if (state === "failure" || state === "error") {
    return { kind: "failed", live, pending, logUrl: statuses?.[0]?.target_url ?? null };
  }
  // "success" here means Vercel finished but this server is still the old
  // build (alias switch in progress) — treat as still deploying.
  return { kind: "deploying", live, pending, since: deployment.created_at };
}

function firstLine(message: string): string {
  return message.split("\n")[0];
}
