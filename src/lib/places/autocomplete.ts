import "server-only";
// Area search for the picker. With GOOGLE_MAPS_SERVER_KEY: Google Places API (New) Autocomplete + Place
// Details, called from the server so the key never reaches a browser. Without it, or if Google fails: the
// built-in Bengaluru locality list. Request shapes follow Google's Places API (New) docs; not yet exercised
// against a live key.
import { config } from "@/config";
import { inCity, LOCALITIES, roundCoord, searchLocalities, type Area } from "@/lib/areas";

export type Suggestion = { id: string; label: string; secondary: string };
export type SearchResult = { source: "google" | "local"; degraded?: boolean; results: Suggestion[] };

const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;
const TOKEN = /^[A-Za-z0-9_-]{8,64}$/;
const rectangle = {
  low: { latitude: config.cityBounds.minLat, longitude: config.cityBounds.minLng },
  high: { latitude: config.cityBounds.maxLat, longitude: config.cityBounds.maxLng },
};

const local = (q: string): SearchResult => ({
  source: "local",
  results: searchLocalities(q).map((a) => ({ id: `area:${a.name}`, label: a.name, secondary: "Bengaluru" })),
});

async function googleJson(url: string | URL, init: RequestInit) {
  const res = await fetch(url, { ...init, cache: "no-store" });
  if (!res.ok) throw new Error(`places ${res.status}`);
  return res.json();
}

export async function searchAreas(q: string, sessionToken?: string | null): Promise<SearchResult> {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key) return local(q);
  try {
    const body = await googleJson("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: { "content-type": "application/json", "X-Goog-Api-Key": key },
      body: JSON.stringify({
        input: q,
        ...(sessionToken && TOKEN.test(sessionToken) ? { sessionToken } : {}),
        includedRegionCodes: ["in"],
        locationRestriction: { rectangle },
      }),
    });
    type Pred = { placeId?: string; text?: { text?: string }; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } } };
    const results = ((body.suggestions ?? []) as { placePrediction?: Pred }[])
      .map((s) => s.placePrediction)
      .filter((p): p is Pred => !!p && PLACE_ID.test(p.placeId ?? ""))
      .map((p) => ({ id: p.placeId!, label: p.structuredFormat?.mainText?.text || p.text?.text || "", secondary: p.structuredFormat?.secondaryText?.text || "" }))
      .filter((r) => r.label);
    return { source: "google", results };
  } catch {
    return { ...local(q), degraded: true }; // the form keeps working on built-in areas
  }
}

export async function areaDetails(id: string, sessionToken?: string | null): Promise<Area | null> {
  if (id.startsWith("area:")) return LOCALITIES.find((a) => a.name === id.slice(5)) ?? null;
  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key || !PLACE_ID.test(id)) return null;
  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`);
  if (sessionToken && TOKEN.test(sessionToken)) url.searchParams.set("sessionToken", sessionToken);
  const body = await googleJson(url, { headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "location,displayName" } });
  const loc = body.location;
  if (!loc || typeof loc.latitude !== "number" || typeof loc.longitude !== "number") return null;
  const area = { name: body.displayName?.text || "Selected place", lat: roundCoord(loc.latitude), lng: roundCoord(loc.longitude) };
  return inCity(area) ? area : null;
}
