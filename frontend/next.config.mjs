import nextEnv from "@next/env";
import path from "path";
import { fileURLToPath } from "url";

const { loadEnvConfig } = nextEnv;

const nextRoot = path.dirname(fileURLToPath(import.meta.url));
// Next.js only auto-loads `.env*` from this folder (`frontend/`). Also load
// `frontend/src/.env*` so `NEXT_PUBLIC_*` works if keys were placed under `src/`.
loadEnvConfig(nextRoot);
loadEnvConfig(path.join(nextRoot, "src"));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /** Same-origin proxy so the browser is not blocked by CORS during `next dev` / Vercel. */
  async rewrites() {
    return [
      {
        source: "/api/maweshi-proxy/chat",
        destination: "https://livestock-ai-assistant.onrender.com/api/chat",
      },
      {
        source: "/api/maweshi-proxy/chat/health",
        destination: "https://livestock-ai-assistant.onrender.com/api/chat/health",
      },
    ];
  },
};

export default nextConfig;
