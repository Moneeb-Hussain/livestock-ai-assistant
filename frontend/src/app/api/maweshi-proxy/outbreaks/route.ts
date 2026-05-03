import { NextRequest, NextResponse } from "next/server";

/**
 * Same-origin proxy for FastAPI `/api/outbreaks` (avoids browser CORS).
 * Prefer this over relying on `next.config` rewrites alone — the route always exists.
 */
function upstreamOrigin(): string {
  const explicit = process.env.MAWESHI_API_UPSTREAM?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const pub = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, "");
  if (pub) return pub;
  return "https://livestock-ai-assistant.onrender.com";
}

async function forward(req: NextRequest, method: string): Promise<NextResponse> {
  const url = new URL(req.url);
  const search = url.search;
  const target = `${upstreamOrigin()}/api/outbreaks${search}`;

  const headers = new Headers();
  const ct = req.headers.get("content-type");
  if (ct) headers.set("content-type", ct);

  const init: RequestInit = {
    method,
    headers,
    cache: "no-store",
  };
  if (method !== "GET" && method !== "HEAD") {
    init.body = await req.text();
  }

  const res = await fetch(target, init);
  const text = await res.text();
  const out = new NextResponse(text, { status: res.status });
  const outCt = res.headers.get("content-type");
  if (outCt) out.headers.set("content-type", outCt);
  return out;
}

export async function GET(req: NextRequest) {
  return forward(req, "GET");
}

export async function POST(req: NextRequest) {
  return forward(req, "POST");
}
