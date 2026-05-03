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
};

export default nextConfig;
