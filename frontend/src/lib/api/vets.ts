import { apiFetch } from "@/lib/api/client";
import type { VetResult, VetSearchParams } from "@/lib/api/types";

function vetsApiAbsoluteUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (base) return `${base}/api/vets`;
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/maweshi-proxy/vets`;
  }
  return "/api/maweshi-proxy/vets";
}

export async function searchNearbyVets(
  params: VetSearchParams,
): Promise<VetResult[]> {
  const q = new URLSearchParams({
    lat: String(params.lat),
    lng: String(params.lng),
    ...(params.radiusKm != null
      ? { radius_km: String(params.radiusKm) }
      : {}),
  });
  const absoluteUrl = `${vetsApiAbsoluteUrl()}?${q.toString()}`;
  return apiFetch<VetResult[]>("/api/vets", { method: "GET" }, { absoluteUrl });
}
