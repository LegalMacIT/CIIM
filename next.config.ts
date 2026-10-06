import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stamp each build with the commit Vercel built it from, so the admin
  // template page can show which version of the app is live.
  env: {
    BUILD_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
    BUILD_COMMIT_MESSAGE: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? "",
    BUILD_REPO: process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG
      ? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}`
      : "",
    BUILD_TIME: new Date().toISOString(),
  },
};

export default nextConfig;
