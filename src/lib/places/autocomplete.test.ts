import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { areaDetails, searchAreas } from "@/lib/places/autocomplete";

const KEY = "AIza-test-key-9f3";
const TOKEN = "3f1c2a9e-77aa-4c1d-9b0e-5d2f6a8c1b44";
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

beforeEach(() => { vi.stubEnv("GOOGLE_MAPS_SERVER_KEY", ""); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("no Google key: built-in locality search", () => {
  it("searches the local list and resolves an area id", async () => {
    const r = await searchAreas("hsr");
    expect(r.source).toBe("local");
    expect(r.results).toEqual([{ id: "area:HSR Layout", label: "HSR Layout", secondary: "Bengaluru" }]);
    expect(await areaDetails("area:HSR Layout")).toMatchObject({ name: "HSR Layout" });
    expect(await areaDetails("area:Atlantis")).toBeNull();
    expect(await areaDetails("ChIJ-aaaaaaaa1")).toBeNull(); // a Google id can't be resolved without a key
  });
});

describe("with a Google key (mocked responses)", () => {
  it("calls Places Autocomplete with the key in a header, a Bengaluru-only restriction and the session token", async () => {
    vi.stubEnv("GOOGLE_MAPS_SERVER_KEY", KEY);
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return ok({
        suggestions: [
          { placePrediction: { placeId: "ChIJ-aaaaaaaa1", structuredFormat: { mainText: { text: "Indiranagar" }, secondaryText: { text: "Bengaluru, Karnataka" } } } },
          { placePrediction: { placeId: "bad id!", text: { text: "Junk" } } }, // invalid id: dropped
          { queryPrediction: { text: { text: "coffee near me" } } }, // not a place: dropped
          { placePrediction: { placeId: "ChIJ-bbbbbbbb2", text: { text: "Only Full Text, Koramangala" } } }, // falls back to text
        ],
      });
    });
    const r = await searchAreas("indira", TOKEN);
    expect(r.source).toBe("google");
    expect(r.results).toEqual([
      { id: "ChIJ-aaaaaaaa1", label: "Indiranagar", secondary: "Bengaluru, Karnataka" },
      { id: "ChIJ-bbbbbbbb2", label: "Only Full Text, Koramangala", secondary: "" },
    ]);
    expect(calls[0].url).toBe("https://places.googleapis.com/v1/places:autocomplete");
    expect(calls[0].init.method).toBe("POST");
    expect((calls[0].init.headers as Record<string, string>)["X-Goog-Api-Key"]).toBe(KEY);
    expect(calls[0].url).not.toContain(KEY);
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.sessionToken).toBe(TOKEN);
    expect(body.includedRegionCodes).toEqual(["in"]);
    expect(body.locationRestriction.rectangle.low).toEqual({ latitude: 12.7, longitude: 77.3 });
    expect(JSON.stringify(r)).not.toContain(KEY);
  });

  it("drops a malformed session token instead of forwarding it", async () => {
    vi.stubEnv("GOOGLE_MAPS_SERVER_KEY", KEY);
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => (bodies.push(JSON.parse(String(init.body))), ok({ suggestions: [] })));
    await searchAreas("x y", "bad token!!");
    await searchAreas("x y", null);
    expect(bodies.every((b) => !("sessionToken" in b))).toBe(true);
  });

  it("falls back to built-in areas, flagged degraded, when Google errors or is unreachable", async () => {
    vi.stubEnv("GOOGLE_MAPS_SERVER_KEY", KEY);
    for (const f of [async () => { throw new Error("ECONNRESET"); }, async () => ({ ok: false, status: 403, json: async () => ({}) }), async () => ({ ok: true, status: 200, json: async () => { throw new Error("bad json"); } })]) {
      vi.stubGlobal("fetch", f);
      const r = await searchAreas("hsr", TOKEN);
      expect(r.source).toBe("local");
      expect(r.degraded).toBe(true);
      expect(r.results[0].label).toBe("HSR Layout");
    }
  });

  it("looks up a place with a field mask and rounds the pin; refuses places outside Bengaluru", async () => {
    vi.stubEnv("GOOGLE_MAPS_SERVER_KEY", KEY);
    const urls: { u: URL; init: RequestInit }[] = [];
    let loc = { latitude: 12.97841, longitude: 77.64083 };
    vi.stubGlobal("fetch", async (u: string | URL, init: RequestInit) => (urls.push({ u: new URL(u), init }), ok({ location: loc, displayName: { text: "Indiranagar" } })));
    expect(await areaDetails("ChIJ-aaaaaaaa1", TOKEN)).toEqual({ name: "Indiranagar", lat: 12.978, lng: 77.641 });
    expect(urls[0].u.origin + urls[0].u.pathname).toBe("https://places.googleapis.com/v1/places/ChIJ-aaaaaaaa1");
    expect(urls[0].u.searchParams.get("sessionToken")).toBe(TOKEN); // assumed query param, see autocomplete.ts
    expect((urls[0].init.headers as Record<string, string>)["X-Goog-FieldMask"]).toBe("location,displayName");
    loc = { latitude: 28.6139, longitude: 77.209 }; // Delhi
    expect(await areaDetails("ChIJ-aaaaaaaa1")).toBeNull();
  });

  it("never lets a hostile id reach the URL", async () => {
    vi.stubEnv("GOOGLE_MAPS_SERVER_KEY", KEY);
    const f = vi.fn(async () => ok({}));
    vi.stubGlobal("fetch", f);
    expect(await areaDetails("../../admin?x=1")).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
});
