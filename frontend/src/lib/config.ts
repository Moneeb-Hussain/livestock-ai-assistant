/** FastAPI base URL (no trailing slash). Browser calls this directly — enable CORS on the API. */
export const appConfig = {
  apiBaseUrl:
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
    "https://livestock-ai-assistant.onrender.com",
} as const;
