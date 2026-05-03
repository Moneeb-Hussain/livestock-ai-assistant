import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side reverse geocode (OpenStreetMap Nominatim).
 * Keeps a proper User-Agent and avoids browser → OSM CORS issues.
 * @see https://operations.osmfoundation.org/policies/nominatim/
 */
const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";

type NominatimAddr = {
  village?: string;
  town?: string;
  city?: string;
  hamlet?: string;
  suburb?: string;
  county?: string;
  state?: string;
  country?: string;
};

function labelFromNominatim(body: {
  display_name?: string;
  address?: NominatimAddr;
}): string | null {
  // With `accept-language=en`, `display_name` is usually fully Roman/English;
  // structured `address` fields may still be in the local script.
  if (body.display_name) {
    return body.display_name.split(",").slice(0, 4).join(",").trim().slice(0, 240);
  }
  const a = body.address;
  if (a) {
    const locality =
      a.village || a.town || a.hamlet || a.suburb || a.city || a.county;
    const region = a.state || a.country;
    if (locality && region) return `${locality}, ${region}`.slice(0, 240);
    if (locality) return String(locality).slice(0, 240);
  }
  return null;
}

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");
  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }

  /** Prefer English names (otherwise e.g. Punjab shows as پنجاب). */
  const acceptLang =
    process.env.NOMINATIM_ACCEPT_LANGUAGE?.trim() || "en-US,en";

  const params = new URLSearchParams({
    lat,
    lon: lng,
    format: "json",
    "accept-language": acceptLang,
  });
  const url = `${NOMINATIM}?${params.toString()}`;

  const ua =
    process.env.NOMINATIM_USER_AGENT?.trim() ||
    "MaweshiAI/1.0 (https://github.com/; outbreak location label)";

  const upstream = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": acceptLang,
      "User-Agent": ua,
    },
    cache: "no-store",
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "geocode_failed", status: upstream.status },
      { status: 502 },
    );
  }

  const json = (await upstream.json()) as {
    display_name?: string;
    address?: NominatimAddr;
  };
  const label = labelFromNominatim(json);
  return NextResponse.json({ label });
}
