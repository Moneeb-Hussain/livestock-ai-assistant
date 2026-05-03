import { NextRequest, NextResponse } from "next/server";

function upstreamOrigin(): string {
  const explicit = process.env.MAWESHI_API_UPSTREAM?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const pub = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, "");
  if (pub) return pub;
  return "https://livestock-ai-assistant.onrender.com";
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const search = url.search;
  const target = `${upstreamOrigin()}/api/vets${search}`;

  const res = await fetch(target, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  const out = new NextResponse(text, { status: res.status });
  const ct = res.headers.get("content-type");
  if (ct) out.headers.set("content-type", ct);
  return out;
}
