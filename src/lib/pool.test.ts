import { describe, expect, it } from "vitest";
import { config } from "@/config";
import { buildPool, factorsFor, meetingPoint, rejection, sharedCeiling, type PoolMember, type TravelFn } from "@/lib/pool";
import { sampleCandidates, type Place } from "@/lib/places/place";

const asha: PoolMember = { id: "m-asha", firstName: "Asha", start: { lat: 12.9784, lng: 77.6408 }, budget: 1500, dealbreakers: [], vibes: ["Cafe"], cuisines: ["South Indian", "Cafe"], maxTravelMin: 40 }; // Indiranagar
const ravi: PoolMember = { id: "m-ravi", firstName: "Ravi", start: { lat: 12.9352, lng: 77.6245 }, budget: 800, dealbreakers: ["no_alcohol"], vibes: [], cuisines: ["Biryani"], maxTravelMin: 40 }; // Koramangala
const meera: PoolMember = { id: "m-meera", firstName: "Meera", start: { lat: 12.9116, lng: 77.6474 }, budget: null, dealbreakers: ["must_have_veg"], vibes: ["Quiet"], cuisines: [], maxTravelMin: 40 }; // HSR
const three = [asha, ravi, meera];
const anywhere = { searchMode: "anywhere_fair" as const, searchArea: null };

const place = (over: Partial<Place> & { id: string }): Place => ({
  name: over.id, area: "Indiranagar", location: { lat: 12.95, lng: 77.63 }, approxLocation: true, address: null,
  cuisines: ["Cafe"], vibes: [], veg: "unknown", servesAlcohol: null, priceRange: null, rating: null, ratingCount: null,
  phone: null, website: null, googleMapsUri: null, photo: null, source: "sample", ...over,
});
const fixedTravel = (min: number): TravelFn => () => min;

describe("meeting point", () => {
  it("is the middle of everyone's start points when the organiser says anywhere fair", () => {
    const { center, name } = meetingPoint(three, anywhere);
    expect(center.lat).toBeCloseTo((12.9784 + 12.9352 + 12.9116) / 3, 5);
    expect(center.lng).toBeCloseTo((77.6408 + 77.6245 + 77.6474) / 3, 5);
    expect(typeof name).toBe("string");
  });
  it("is the chosen area when the organiser picked one", () => {
    const area = { name: "Jayanagar", lat: 12.925, lng: 77.5938 };
    expect(meetingPoint(three, { searchMode: "area", searchArea: area })).toEqual({ center: area, name: "Jayanagar" });
  });
});

describe("budget and dealbreaker filters", () => {
  it("the shared ceiling is the smallest budget given, ignoring people who skipped", () => {
    expect(sharedCeiling(three)).toBe(800);
    expect(sharedCeiling([meera])).toBeNull();
  });
  it("drops a place whose cheapest price per head is above the ceiling, and keeps one at or under it", () => {
    expect(rejection(place({ id: "a", priceRange: { min: 900, max: 1500 } }), three, 800)).toBe("budget");
    expect(rejection(place({ id: "b", priceRange: { min: 800, max: 1500 } }), three, 800)).toBeNull();
  });
  it("an unknown price can't break a budget, so it passes (and is flagged on the card)", () => {
    expect(rejection(place({ id: "c", priceRange: null }), three, 800)).toBeNull();
  });
  it("no_alcohol drops places known to serve alcohol, keeps unknown ones", () => {
    expect(rejection(place({ id: "d", servesAlcohol: true }), [ravi], null)).toBe("dealbreaker");
    expect(rejection(place({ id: "e", servesAlcohol: null }), [ravi], null)).toBeNull();
    expect(rejection(place({ id: "f", servesAlcohol: true }), [asha], null)).toBeNull(); // nobody asked for it
  });
});

describe("buildPool with the sample restaurants", () => {
  const pool = buildPool(three, anywhere, sampleCandidates());

  it("returns a full deck of at least 10 places, plus a reserve behind it", () => {
    expect(pool.deck.length).toBeGreaterThanOrEqual(config.deck.size);
    expect(pool.reserve.length).toBeGreaterThan(0);
    expect(pool.shortfall).toBe(false);
  });
  it("never puts the same place in the deck and the reserve", () => {
    const ids = [...pool.deck, ...pool.reserve].map((e) => e.place.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("every card is within every member's travel limit", () => {
    for (const e of [...pool.deck, ...pool.reserve]) for (const m of three) expect(e.travel[m.id]).toBeLessThanOrEqual(m.maxTravelMin);
  });
  it("breaks no dealbreaker: nothing known to serve alcohol when someone said no alcohol", () => {
    for (const e of [...pool.deck, ...pool.reserve]) expect(e.place.servesAlcohol).not.toBe(true);
  });
  it("has no more than 3 of one primary cuisine in the deck", () => {
    const counts: Record<string, number> = {};
    for (const e of pool.deck) counts[e.place.cuisines[0]] = (counts[e.place.cuisines[0]] ?? 0) + 1;
    for (const n of Object.values(counts)) expect(n).toBeLessThanOrEqual(config.deck.maxSameCuisine);
  });
  it("gives each card a travel time for every member and one honest reason line", () => {
    for (const e of pool.deck) {
      expect(Object.keys(e.travel).sort()).toEqual(three.map((m) => m.id).sort());
      expect(e.reason).toMatch(/Longest trip \d+ min/);
      expect(e.maxTravel).toBe(Math.max(...Object.values(e.travel)));
    }
  });
  it("is deterministic: the same answers give the same deck in the same order", () => {
    const again = buildPool([...three].reverse(), anywhere, sampleCandidates());
    expect(again.deck.map((e) => e.place.id)).toEqual(pool.deck.map((e) => e.place.id));
  });
  it("never carries anyone's budget in the stored pool", () => {
    const text = JSON.stringify(pool);
    expect(text).not.toContain("1500");
    expect(text).not.toMatch(/"budget":\s*\d{3,}/);
    expect(text).not.toContain("800");
  });
});

describe("buildPool rules", () => {
  it("drops a place when ANY member's trip is over that member's limit, and widens the search to find enough", () => {
    const strict: PoolMember = { ...asha, id: "m-strict", maxTravelMin: 15 };
    const places = Array.from({ length: 12 }, (_, i) => place({ id: `p${i}`, cuisines: [`C${i}`] }));
    const travel: TravelFn = (from) => (from === strict.start ? (strict.maxTravelMin + 1) : 10);
    const pool = buildPool([strict, ravi], anywhere, places, travel);
    expect(pool.deck).toHaveLength(0);
    expect(pool.shortfall).toBe(true);
    expect(pool.rejected.travel).toBe(12);
  });
  it("returns a shorter deck and says so when fewer than 10 places fit", () => {
    const places = Array.from({ length: 6 }, (_, i) => place({ id: `p${i}`, cuisines: [`C${i}`] }));
    const pool = buildPool([asha, ravi], anywhere, places, fixedTravel(10));
    expect(pool.deck).toHaveLength(6);
    expect(pool.shortfall).toBe(true);
  });
  it("applies the diversity cap but still fills the deck when nothing else is left", () => {
    const places = Array.from({ length: 11 }, (_, i) => place({ id: `p${i}`, cuisines: ["Cafe"] }));
    const pool = buildPool([asha, ravi], anywhere, places, fixedTravel(10));
    expect(pool.deck).toHaveLength(config.deck.size);
  });
  it("prefers the fairer place when everything else is equal", () => {
    const near = place({ id: "near", cuisines: ["A"] }), far = place({ id: "far", cuisines: ["B"] });
    const travel: TravelFn = (_f, to) => (to === far.location ? 35 : 10);
    far.location = { lat: 12.96, lng: 77.64 };
    const pool = buildPool([asha, ravi], anywhere, [far, near], travel);
    expect(pool.deck[0].place.id).toBe("near");
  });
  it("keeps price out of the picture but lists it as unconfirmed when someone gave a budget", () => {
    const pool = buildPool([asha, ravi], anywhere, [place({ id: "x" })], fixedTravel(10));
    expect(pool.deck[0].unconfirmed).toContain("price");
  });
});

describe("scoring", () => {
  it("rates a short, even trip higher on fairness than a long, uneven one", () => {
    const p = place({ id: "p" });
    const fair = factorsFor(p, [asha, ravi], { [asha.id]: 15, [ravi.id]: 15 }).fairness;
    const unfair = factorsFor(p, [asha, ravi], { [asha.id]: 5, [ravi.id]: 35 }).fairness;
    expect(fair).toBeGreaterThan(unfair);
  });
  it("treats an unknown rating as neutral, not as a penalty", () => {
    expect(factorsFor(place({ id: "p" }), [asha], { [asha.id]: 10 }).quality).toBe(0.5);
  });
  it("pulls a rating toward neutral when few people have rated", () => {
    const few = factorsFor(place({ id: "p", rating: 5, ratingCount: 2 }), [asha], { [asha.id]: 10 }).quality;
    const many = factorsFor(place({ id: "p", rating: 5, ratingCount: 2000 }), [asha], { [asha.id]: 10 }).quality;
    expect(many).toBeGreaterThan(few);
  });
});
