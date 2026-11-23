import { describe, expect, it } from "vitest";
import { fromMap, inCity, km, LOCALITIES, nearestLocality, roundCoord, searchLocalities, toMap } from "@/lib/areas";

describe("areas", () => {
  it("every built-in locality is inside the city bounds", () => {
    for (const a of LOCALITIES) expect(inCity(a), a.name).toBe(true);
  });

  it("inCity rejects other cities, non-numbers and missing values", () => {
    expect(inCity({ lat: 28.6, lng: 77.2 })).toBe(false); // Delhi
    expect(inCity({ lat: 19.07, lng: 72.87 })).toBe(false); // Mumbai
    expect(inCity({ lat: Number.NaN, lng: 77.6 })).toBe(false);
    expect(inCity({ lat: 12.9 })).toBe(false);
    expect(inCity({ lat: "12.9" as unknown as number, lng: 77.6 })).toBe(false);
    expect(inCity({ lat: 12.97, lng: 77.6 })).toBe(true);
  });

  it("rounds coordinates to about 110 m", () => {
    expect(roundCoord(12.93527)).toBe(12.935);
    expect(roundCoord(77.62451)).toBe(77.625);
  });

  it("finds the nearest locality to a dropped pin", () => {
    expect(nearestLocality({ lat: 12.936, lng: 77.625 }).name).toBe("Koramangala");
    expect(nearestLocality({ lat: 12.98, lng: 77.64 }).name).toBe("Indiranagar");
    expect(nearestLocality({ lat: 12.97, lng: 77.75 }).name).toBe("Whitefield");
  });

  it("searches by prefix first, then by substring, case-insensitively, and caps the list", () => {
    expect(searchLocalities("indira")[0].name).toBe("Indiranagar");
    expect(searchLocalities("NAGAR").map((a) => a.name)).toContain("Indiranagar"); // substring match
    expect(searchLocalities("j")[0].name.toLowerCase().startsWith("j")).toBe(true);
    expect(searchLocalities("a", 3)).toHaveLength(3);
    expect(searchLocalities("   ")).toEqual([]);
    expect(searchLocalities("zzzzzz")).toEqual([]);
  });

  it("measures distance sensibly", () => {
    const d = km(LOCALITIES.find((a) => a.name === "Indiranagar")!, LOCALITIES.find((a) => a.name === "Koramangala")!);
    expect(d).toBeGreaterThan(4);
    expect(d).toBeLessThan(7);
  });

  it("map position and coordinates round-trip, and taps outside the map are clamped", () => {
    const p = { lat: 12.9352, lng: 77.6245 };
    const m = toMap(p);
    const back = fromMap(m.x, m.y);
    expect(back.lat).toBeCloseTo(p.lat, 6);
    expect(back.lng).toBeCloseTo(p.lng, 6);
    const clamped = fromMap(-5, 9);
    expect(clamped.lat).toBeGreaterThanOrEqual(12.82 - 1e-9);
    expect(clamped.lng).toBeGreaterThanOrEqual(77.5 - 1e-9);
  });
});
