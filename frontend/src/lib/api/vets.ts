import { apiFetch } from "@/lib/api/client";
import type { VetResult, VetSearchParams } from "@/lib/api/types";

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
  return apiFetch<VetResult[]>(`/api/vets?${q.toString()}`, {
    method: "GET",
  });
}
