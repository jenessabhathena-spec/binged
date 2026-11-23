import { describe, expect, it } from "vitest";
import { profileInputFromForm, validateProfile } from "@/lib/profile";

const koramangala = { name: "Koramangala", lat: 12.9352, lng: 77.6245 };

describe("validateProfile", () => {
  it("accepts a name and a home area, rounding the pin to ~110 m", () => {
    const r = validateProfile({ name: "  Asha   Rao ", home: { name: "Koramangala", lat: 12.93527, lng: 77.62451 }, work: null });
    expect(r).toEqual({ ok: true, value: { name: "Asha Rao", home: { name: "Koramangala", lat: 12.935, lng: 77.625 }, work: null } });
  });

  it("requires a name and a home area, but not a work area", () => {
    const r = validateProfile({ name: " ", home: null, work: null });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.name).toBeTruthy();
      expect(r.errors.home).toBeTruthy();
      expect(r.errors.work).toBeUndefined();
    }
  });

  it("rejects a pin outside Bengaluru, for home and for work", () => {
    const delhi = { name: "Connaught Place", lat: 28.6315, lng: 77.2167 };
    const r = validateProfile({ name: "Asha", home: delhi, work: delhi });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.home).toMatch(/Bengaluru/);
      expect(r.errors.work).toMatch(/Bengaluru/);
    }
  });

  it("rejects an area with no pin, a pin with no name, and non-numeric coordinates", () => {
    expect(validateProfile({ name: "A", home: { name: "Indiranagar" }, work: null }).ok).toBe(false);
    expect(validateProfile({ name: "A", home: { lat: 12.97, lng: 77.64 }, work: null }).ok).toBe(false);
    expect(validateProfile({ name: "A", home: { name: "X", lat: Number("abc"), lng: 77.6 }, work: null }).ok).toBe(false);
  });

  it("keeps an optional work area when given and valid", () => {
    const r = validateProfile({ name: "Asha", home: koramangala, work: { name: "Whitefield", lat: 12.9698, lng: 77.75 } });
    expect(r.ok && r.value.work?.name).toBe("Whitefield");
  });

  it("limits name length", () => {
    expect(validateProfile({ name: "x".repeat(61), home: koramangala, work: null }).ok).toBe(false);
  });
});

describe("profileInputFromForm: no address field exists (SPEC 2.2)", () => {
  it("reads only the name and the two area pins, and ignores anything else sent", () => {
    const fd = new FormData();
    fd.set("name", "Asha");
    fd.set("homeName", "Koramangala"); fd.set("homeLat", "12.9352"); fd.set("homeLng", "77.6245");
    fd.set("address", "Flat 4B, Secret Apartments, 12th Main"); // a street address, if someone tried to send one
    fd.set("email", "attacker@example.com"); // email always comes from Google, never the form
    const input = profileInputFromForm(fd);
    expect(Object.keys(input).sort()).toEqual(["home", "name", "work"]);
    expect(JSON.stringify(input)).not.toContain("Secret Apartments");
    expect(JSON.stringify(input)).not.toContain("attacker");
    expect(input.work).toBeNull();
  });
});
