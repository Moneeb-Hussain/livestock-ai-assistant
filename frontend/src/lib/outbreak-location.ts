/**
 * Browser location for outbreak reports (no Google Maps key).
 * Coordinates: `navigator.geolocation`.
 * Place name: reverse geocode via same-origin `/api/geocode/reverse` (OpenStreetMap Nominatim).
 */

export type OutbreakCoordinates = {
  latitude: number;
  longitude: number;
};

/** From Permissions API when supported (Chrome). */
export type GeolocationPermissionHint = "granted" | "denied" | "prompt" | "unknown";

export async function queryGeolocationPermission(): Promise<GeolocationPermissionHint> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) {
    return "unknown";
  }
  try {
    const r = await navigator.permissions.query({
      name: "geolocation" as PermissionName,
    });
    if (r.state === "granted") return "granted";
    if (r.state === "denied") return "denied";
    return "prompt";
  } catch {
    return "unknown";
  }
}

/** MDN: GeolocationPositionError.PERMISSION_DENIED === 1 */
const PERMISSION_DENIED = 1;

export type OutbreakCoordinatesResult =
  | { ok: true; coords: OutbreakCoordinates }
  | {
      ok: false;
      reason:
        | "permission_denied"
        | "position_unavailable"
        | "timeout"
        | "unsupported";
    };

/**
 * Prompts for device location (browser permission UI when state is "prompt").
 * If the user has already blocked this origin in site settings, this usually returns
 * `permission_denied` immediately — **no** second prompt until they reset the block.
 */
export function requestOutbreakCoordinates(options?: {
  timeoutMs?: number;
}): Promise<OutbreakCoordinatesResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve({ ok: false, reason: "unsupported" });
  }
  const timeoutMs = options?.timeoutMs ?? 15_000;
  return new Promise((resolve) => {
    const timer = window.setTimeout(
      () => resolve({ ok: false, reason: "timeout" }),
      timeoutMs,
    );
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(timer);
        resolve({
          ok: true,
          coords: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          },
        });
      },
      (err) => {
        window.clearTimeout(timer);
        const code =
          err && typeof err === "object" && "code" in err
            ? Number((err as GeolocationPositionError).code)
            : 0;
        if (code === PERMISSION_DENIED) {
          resolve({ ok: false, reason: "permission_denied" });
          return;
        }
        if (code === 2) {
          resolve({ ok: false, reason: "position_unavailable" });
          return;
        }
        if (code === 3) {
          resolve({ ok: false, reason: "timeout" });
          return;
        }
        resolve({ ok: false, reason: "position_unavailable" });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 300_000,
        timeout: timeoutMs,
      },
    );
  });
}

/** Human-readable label for `location_name` (Supabase / backend). */
export async function reverseGeocodeLabel(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  const q = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
  });
  try {
    const res = await fetch(`/api/geocode/reverse?${q.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { label?: string | null };
    const label = data.label;
    return typeof label === "string" && label.trim() ? label.trim() : null;
  } catch {
    return null;
  }
}
