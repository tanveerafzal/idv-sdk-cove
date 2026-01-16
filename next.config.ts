import type { NextConfig } from "next";
import { execSync } from "child_process";

// Generate version from git commit timestamp
function getGitVersion(): string {
  try {
    const timestamp = execSync("git log -1 --format=%ci", { encoding: "utf-8" }).trim();
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `v${year}.${month}.${day}.${hours}${minutes}`;
  } catch {
    return "v0.0.0";
  }
}

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: getGitVersion(),
  },
};

export default nextConfig;
