import { describe, expect, it } from "vitest";
import { decide, rank, type Swipe, type TieBreak } from "@/lib/matching";
import type { PoolEntry } from "@/lib/pool";
import type { Place } from "@/lib/places/place";

const place = (id: string, rating: number | null = null): Place => ({
  id, name: id, area: "Indiranagar", location: { lat: 12.95, lng: 77.63 }, approxLocation: true, address: null, cuisines: ["Cafe"], vibes: [],
  veg: "unknown", servesAlcohol: null, priceRange: null, rating, ratingCount: null, phone: null, website: null, googleMapsUri: null, photo: null, source: "sample",
});
const entry = (id: string, maxTravel: number, spread = 0, rating: number | null = null): PoolEntry => ({
  place: place(id, rating), score: 0.5, travel: {}, maxTravel, spread, reason: "", unconfirmed: [],
});
const DECK = [entry("A", 30), entry("B", 20), entry("C", 25), entry("D", 15)];
const yes = (m: string, ...ids: string[]): Swipe[] => ids.map((placeId) => ({ memberId: m, placeId, liked: true }));
const no = (m: string, ...ids: string[]): Swipe[] => ids.map((placeId) => ({ memberId: m, placeId, liked: false }));
const winnerId = (o: ReturnType<typeof decide>) => (o.kind === "winner" ? o.winner.entry.place.id : o.kind);

describe("ranking", () => {
  it("a full match is liked by every member who swiped", () => {
    const r = rank(DECK, [...yes("1", "A", "B"), ...no("1", "C", "D"), ...yes("2", "B", "C"), ...no("2", "A", "D")]);
    expect(r.fullMatches.map((x) => x.entry.place.id)).toEqual(["B"]);
  });
  it("orders full matches by the shortest longest-trip, then rating", () => {
    const deck = [entry("A", 30, 0, 4.9), entry("B", 20, 0, 3.0), entry("C", 20, 0, 4.5)];
    const r = rank(deck, [...yes("1", "A", "B", "C"), ...yes("2", "A", "B", "C")]);
    expect(r.fullMatches.map((x) => x.entry.place.id)).toEqual(["C", "B", "A"]); // B and C tie on travel: C has the better rating
  });
  it("ignores swipes on places that aren't in the deck", () => {
    const r = rank(DECK, [...yes("1", "Z"), ...yes("2", "A")]);
    expect(r.participants).toEqual(["2"]);
  });
  it("counts a place a partial swiper never reached as not liked", () => {
    const r = rank(DECK, [...yes("1", "A", "B"), ...yes("2", "A")]);
    expect(r.fullMatches.map((x) => x.entry.place.id)).toEqual(["A"]);
  });
  it("the shortlist holds at most 5 places and only ones someone said yes to", () => {
    const deck = Array.from({ length: 8 }, (_, i) => entry(`P${i}`, 10 + i));
    const r = rank(deck, yes("1", "P0", "P1", "P2", "P3", "P4", "P5", "P6"));
    expect(r.shortlist).toHaveLength(5);
    expect(r.shortlist.every((s) => s.yesCount > 0)).toBe(true);
  });
});

describe("deciding", () => {
  it("picks the fairest full match as the winner and lists runner-ups", () => {
    const r = rank(DECK, [...yes("1", "A", "B", "C"), ...yes("2", "A", "B", "C")]);
    const o = decide(r);
    expect(winnerId(o)).toBe("B"); // 20 min beats 25 and 30
    expect(o.kind === "winner" && o.runnerUps.map((x) => x.entry.place.id)).toEqual(["C", "A"]);
    expect(o.kind === "winner" && o.via).toBe("full_match");
  });
  it("is deterministic whatever order the swipes arrive in", () => {
    const swipes = [...yes("1", "A", "C"), ...no("1", "B", "D"), ...yes("2", "C", "B"), ...no("2", "A", "D"), ...yes("3", "C"), ...no("3", "A", "B", "D")];
    const forwards = decide(rank(DECK, swipes)), backwards = decide(rank(DECK, [...swipes].reverse()));
    expect(winnerId(forwards)).toBe(winnerId(backwards));
    expect(winnerId(forwards)).toBe("C");
  });
  it("with no full match asks for a vote between the top two by yes-count", () => {
    const r = rank(DECK, [...yes("1", "A", "B"), ...yes("2", "A", "C"), ...yes("3", "B", "C"), ...no("3", "A")]);
    const o = decide(r);
    expect(o.kind).toBe("tiebreak");
    if (o.kind === "tiebreak") expect(o.options.map((x) => x.entry.place.id)).toEqual(["B", "C"]); // A,B,C each have 2: fairness B(20) < C(25) < A(30)
  });
  it("the vote's majority wins once it closes", () => {
    const r = rank(DECK, [...yes("1", "A", "B"), ...yes("2", "A", "C"), ...yes("3", "B", "C"), ...no("3", "A")]);
    const tie: TieBreak = { optionIds: ["B", "C"], votes: { "1": "B", "2": "C", "3": "C" }, closed: true };
    const o = decide(r, tie);
    expect(winnerId(o)).toBe("C");
    expect(o.kind === "winner" && o.via).toBe("tiebreak");
  });
  it("stays open until the vote closes", () => {
    const r = rank(DECK, [...yes("1", "A"), ...yes("2", "B")]);
    // B is fairer (20 min) than A (30 min), so the pair is [B, A]; a lopsided vote still doesn't decide while open.
    const o = decide(r, { optionIds: ["B", "A"], votes: { "1": "A", "2": "A" }, closed: false });
    expect(o.kind).toBe("tiebreak");
    expect(decide(r, { optionIds: ["B", "A"], votes: { "1": "A", "2": "A" }, closed: true }).kind).toBe("winner");
  });
  it("a tied vote goes to the organiser, whose choice then decides", () => {
    const r = rank(DECK, [...yes("1", "A"), ...yes("2", "B")]);
    const ids = decide(r).kind === "tiebreak" ? (decide(r) as { options: [{ entry: PoolEntry }, { entry: PoolEntry }] }).options.map((x) => x.entry.place.id) : [];
    const tied: TieBreak = { optionIds: ids as [string, string], votes: { "1": ids[0], "2": ids[1] }, closed: true };
    expect(decide(r, tied).kind).toBe("organiser_decides");
    const o = decide(r, { ...tied, organiserChoice: ids[1] });
    expect(winnerId(o)).toBe(ids[1]);
    expect(o.kind === "winner" && o.via).toBe("organiser");
  });
  it("ignores a stale vote that was about a different pair of places", () => {
    const r = rank(DECK, [...yes("1", "A"), ...yes("2", "B")]);
    const o = decide(r, { optionIds: ["C", "D"], votes: {}, closed: true });
    expect(o.kind).toBe("tiebreak");
  });
  it("a single place with any yes wins outright", () => {
    expect(winnerId(decide(rank(DECK, [...yes("1", "C"), ...no("1", "A", "B", "D"), ...no("2", "A", "B", "C", "D")])))).toBe("C");
  });
  it("reports no match when nobody said yes to anything", () => {
    expect(decide(rank(DECK, [...no("1", "A", "B"), ...no("2", "A", "B")])).kind).toBe("no_match");
  });
});
