"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, MapPin, Navigation } from "lucide-react";
import { searchNearbyVets } from "@/lib/api/vets";
import { ApiError } from "@/lib/api/client";
import type { VetResult } from "@/lib/api/types";
import {
  queryGeolocationPermission,
  requestOutbreakCoordinates,
} from "@/lib/outbreak-location";
import { cn } from "@/lib/utils";

const RADII_KM = [10, 25, 50] as const;

/** OSM embed bbox around a point (approximate km → degrees). */
function osmEmbedUrl(lat: number, lng: number, radiusKm: number): string {
  const dlat = radiusKm / 111;
  const cos = Math.cos((lat * Math.PI) / 180);
  const dlng = radiusKm / (111 * Math.max(0.35, Math.abs(cos)));
  const pad = 0.12;
  const minlat = lat - dlat * (1 + pad);
  const maxlat = lat + dlat * (1 + pad);
  const minlng = lng - dlng * (1 + pad);
  const maxlng = lng + dlng * (1 + pad);
  const marker = `${lat},${lng}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minlng},${minlat},${maxlng},${maxlat}&layer=mapnik&marker=${encodeURIComponent(marker)}`;
}

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-neutral-200/90 motion-reduce:animate-none",
        className,
      )}
      aria-hidden
    />
  );
}

function VetResultsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-busy="true" aria-label="Loading clinics">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <SkeletonBar className="h-5 w-[55%]" />
            <SkeletonBar className="h-6 w-14 shrink-0 rounded-full" />
          </div>
          <SkeletonBar className="mt-3 h-3.5 w-full" />
          <SkeletonBar className="mt-2 h-3.5 w-[70%]" />
          <SkeletonBar className="mt-4 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

function MapPreview({
  lat,
  lng,
  radiusKm,
  className,
}: {
  lat: number;
  lng: number;
  radiusKm: number;
  className?: string;
}) {
  const src = useMemo(
    () => osmEmbedUrl(lat, lng, radiusKm),
    [lat, lng, radiusKm],
  );
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-neutral-200/90 bg-neutral-100 shadow-sm",
        className,
      )}
    >
      <iframe
        title="OpenStreetMap — your search area"
        src={src}
        className="h-[min(420px,45vh)] w-full min-h-[220px] border-0 sm:min-h-[280px] lg:h-[min(480px,calc(100vh-14rem))] lg:min-h-[320px]"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="border-t border-neutral-200/80 bg-white px-3 py-2.5">
        <a
          href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=13/${lat}/${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
        >
          Open full map
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      </div>
    </div>
  );
}

export function NearbyVetsView() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [radiusKm, setRadiusKm] = useState<number>(25);
  const [vets, setVets] = useState<VetResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoHint, setGeoHint] = useState<string | null>(null);

  const fetchVets = useCallback(async (lat: number, lng: number, r: number) => {
    setLoading(true);
    setError(null);
    try {
      const list = await searchNearbyVets({ lat, lng, radiusKm: r });
      setVets(Array.isArray(list) ? list : []);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(
          e.status === 503
            ? "Map service is busy or unreachable. Try again shortly."
            : e.message || "Request failed.",
        );
      } else {
        setError("Could not load clinics. Check your connection.");
      }
      setVets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!coords) return;
    void fetchVets(coords.lat, coords.lng, radiusKm);
  }, [coords, radiusKm, fetchVets]);

  const handleUseLocation = useCallback(async () => {
    setGeoHint(null);
    setLocating(true);
    setError(null);
    try {
      const perm = await queryGeolocationPermission();
      if (perm === "denied") {
        setGeoHint(
          "This site is blocked from location in the browser. Allow location for this site in the address bar, then try again.",
        );
        setLocating(false);
        return;
      }
      const result = await requestOutbreakCoordinates({ timeoutMs: 18_000 });
      if (!result.ok) {
        if (result.reason === "permission_denied") {
          setGeoHint(
            "Location was denied. Allow location for this page, or try again after changing site settings.",
          );
        } else if (result.reason === "unsupported") {
          setGeoHint("This browser does not support location.");
        } else if (result.reason === "timeout") {
          setGeoHint("Location timed out. Try outdoors or a stronger signal.");
        } else {
          setGeoHint("Could not read your position. Try again.");
        }
        setLocating(false);
        return;
      }
      setCoords({
        lat: result.coords.latitude,
        lng: result.coords.longitude,
      });
    } finally {
      setLocating(false);
    }
  }, []);

  const shell = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-neutral-50/90">
      <header className="shrink-0 border-b border-neutral-200/70 bg-white">
        <div className={cn(shell, "py-8 lg:py-10")}>
          <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-10">
            <div className="lg:col-span-7">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                OpenStreetMap data
              </p>
              <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
                Nearby vets
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-600">
                Veterinary clinics from OpenStreetMap (Overpass). Coverage varies
                by area — rural regions may have fewer mapped clinics.
              </p>
            </div>

            <div className="mt-8 rounded-2xl border border-neutral-200/90 bg-neutral-50/90 p-4 sm:p-5 lg:col-span-5 lg:mt-0">
              <p className="text-xs font-medium text-neutral-500">Search</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <button
                  type="button"
                  disabled={locating}
                  onClick={() => void handleUseLocation()}
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-5",
                    "bg-brand text-sm font-semibold text-brand-foreground shadow-sm",
                    "transition hover:opacity-95 active:opacity-90 disabled:opacity-50",
                    "sm:flex-1 sm:min-w-[11rem]",
                  )}
                >
                  {locating ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Navigation className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                  Use my location
                </button>

                {coords ? (
                  <label className="flex min-w-[10rem] flex-1 flex-col gap-1.5 text-sm sm:max-w-[12rem]">
                    <span className="font-medium text-neutral-700">Radius</span>
                    <select
                      className={cn(
                        "min-h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2",
                        "text-sm font-medium text-neutral-900 outline-none ring-brand focus:ring-2",
                      )}
                      value={radiusKm}
                      onChange={(e) => setRadiusKm(Number(e.target.value))}
                      disabled={loading}
                    >
                      {RADII_KM.map((r) => (
                        <option key={r} value={r}>
                          {r} km
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>

              {geoHint ? (
                <p className="mt-3 rounded-xl bg-amber-50/90 px-3 py-2.5 text-xs leading-relaxed text-amber-950 ring-1 ring-amber-100 sm:text-sm">
                  {geoHint}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className={cn(shell, "py-6 sm:py-8 lg:py-10")}>
          {!coords ? (
            <div className="mx-auto max-w-2xl rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="mx-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-muted text-brand sm:mx-0">
                  <MapPin className="h-7 w-7" strokeWidth={1.5} aria-hidden />
                </div>
                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <p className="font-semibold text-neutral-900">
                    Start with your location
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                    We send coordinates only to your LivestockAI backend. It queries
                    OpenStreetMap for nearby veterinary amenities — no Google
                    Maps key required.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
              <div className="min-w-0 lg:col-span-7">
                {loading ? (
                  <div className="space-y-3">
                    <p className="text-sm text-neutral-500">
                      Searching OpenStreetMap…
                    </p>
                    <VetResultsSkeleton />
                  </div>
                ) : error ? (
                  <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 px-5 py-6 text-center text-sm text-amber-950">
                    {error}
                  </div>
                ) : vets.length === 0 ? (
                  <div className="rounded-2xl border border-neutral-200/80 bg-white px-6 py-10 text-center shadow-sm">
                    <p className="font-semibold text-neutral-900">
                      No clinics in this radius
                    </p>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-neutral-600">
                      Nothing tagged{" "}
                      <code className="text-xs">amenity=veterinary</code> or{" "}
                      <code className="text-xs">healthcare=veterinary</code>{" "}
                      within {radiusKm} km. Try a larger radius or browse the map
                      →
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-neutral-800">
                        {vets.length} clinic{vets.length === 1 ? "" : "s"} nearby
                      </p>
                      <p className="text-xs text-neutral-500">
                        Sorted by distance
                      </p>
                    </div>
                    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-1">
                      {vets.map((v, i) => (
                        <li key={`${v.mapUrl}-${i}`}>
                          <article
                            className={cn(
                              "flex h-full flex-col rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-sm",
                              "transition-shadow hover:shadow-md",
                            )}
                          >
                            <div className="flex items-start justify-between gap-2 border-b border-neutral-100 pb-3">
                              <h2 className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-neutral-900">
                                {v.name}
                              </h2>
                              <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-neutral-700">
                                {v.distanceKm.toFixed(1)} km
                              </span>
                            </div>
                            <p className="mt-3 line-clamp-2 flex-1 text-sm leading-relaxed text-neutral-600">
                              {v.address}
                            </p>
                            <a
                              href={v.mapUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                "mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-neutral-200",
                                "bg-neutral-50/80 py-2.5 text-sm font-medium text-brand",
                                "transition hover:bg-brand-muted/60 hover:border-brand/25",
                              )}
                            >
                              Open on OpenStreetMap
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                            </a>
                          </article>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              {coords ? (
                <>
                  <div className="lg:hidden">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Your area
                    </p>
                    <MapPreview
                      lat={coords.lat}
                      lng={coords.lng}
                      radiusKm={radiusKm}
                    />
                  </div>
                  <aside className="hidden lg:col-span-5 lg:block">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Map preview
                    </p>
                    <MapPreview
                      lat={coords.lat}
                      lng={coords.lng}
                      radiusKm={radiusKm}
                    />
                    <p className="mt-3 text-xs leading-relaxed text-neutral-500">
                      Pins and listings come from volunteer mappers. Always call
                      ahead before visiting.
                    </p>
                  </aside>
                </>
              ) : null}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
