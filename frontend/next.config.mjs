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
