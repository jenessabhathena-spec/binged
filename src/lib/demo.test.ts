import { describe, expect, it } from "vitest";
import { buildDemoPool, DEMO_PEOPLE, DEMO_YOU, friendSwipes } from "@/lib/demo";
import { decide, rank, type Swipe } from "@/lib/matching";

const pool = buildDemoPool();
const deck = pool.deck;
const you = (liked: (i: number) => boolean): Swipe[] => deck.map((e, i) => ({ memberId: DEMO_YOU, placeId: e.place.id, liked: liked(i) }));

describe("the demo group", () => {
  it("gets a full deck of 10 places that fit all three people", () => {
    expect(deck).toHaveLength(10);
    expect(pool.shortfall).toBe(false);
    for (const e of deck) for (const p of DEMO_PEOPLE) expect(e.travel[p.id]).toBeLessThanOrEqual(p.maxTravelMin);
  });

  it("the pretend friends swipe every card, and like some but not all", () => {
    const fs = friendSwipes(deck);
    expect(fs).toHaveLength(20);
    for (const id of ["ravi", "meera"]) {
      const liked = fs.filter((s) => s.memberId === id && s.liked).length;
      expect(liked).toBeGreaterThan(0);
      expect(liked).toBeLessThan(10);
    }
  });

  it("is deterministic: the same deck every time", () => {
    expect(buildDemoPool().deck.map((e) => e.place.id)).toEqual(deck.map((e) => e.place.id));
  });

  it("saying yes to everything always finds a winner, so a first-time viewer never hits a dead end", () => {
    const o = decide(rank(deck, [...you(() => true), ...friendSwipes(deck)]));
    expect(o.kind).toBe("winner");
  });

  it("saying no to everything still leaves the friends' picks, so it goes to a final vote", () => {
    expect(decide(rank(deck, [...you(() => false), ...friendSwipes(deck)])).kind).toBe("tiebreak");
  });

  it("a full match exists for the friends together, so a good swipe can end in 'everyone agreed'", () => {
    const fs = friendSwipes(deck);
    const both = deck.filter((e) => ["ravi", "meera"].every((m) => fs.some((s) => s.memberId === m && s.placeId === e.place.id && s.liked)));
    expect(both.length).toBeGreaterThanOrEqual(2);
  });

  it("a mix of yes and no ends in a winner or a final vote, never an error", () => {
    for (let k = 1; k < 6; k++) {
      const o = decide(rank(deck, [...you((i) => i % k === 0), ...friendSwipes(deck)]));
      expect(["winner", "tiebreak", "no_match"]).toContain(o.kind);
    }
  });
});

import { demoGroup, MIN_PERSONAL_DECK, type DemoYou } from "@/lib/demo";
import { EMPTY_PREFERENCES } from "@/lib/preferences";

const priya: DemoYou = { firstName: "Priya", areaName: "Jayanagar", start: { lat: 12.925, lng: 77.5938 }, prefs: { ...EMPTY_PREFERENCES, cuisines: ["Biryani"], budgetPerPerson: 600, vibes: ["Family"], dealbreakers: ["must_have_veg"], maxTravelMin: 30 } };

describe("the demo built from your own profile", () => {
  it("puts you first with your own name, start and tastes, and keeps the same two friends", () => {
    const g = demoGroup(priya);
    expect(g.map((p) => p.firstName)).toEqual(["Priya", "Ravi", "Meera"]);
    expect(g[0]).toMatchObject({ id: DEMO_YOU, start: priya.start, budget: 600, cuisines: ["Biryani"], dealbreakers: ["must_have_veg"], maxTravelMin: 30 });
  });

  it("without a profile it is the sample group", () => {
    expect(demoGroup(undefined)).toBe(DEMO_PEOPLE);
  });

  it("builds a real deck from the personal group, and your swipes use your id so matching still works", () => {
    const g = demoGroup(priya);
    const p = buildDemoPool(g);
    expect(p.deck.length).toBeGreaterThanOrEqual(MIN_PERSONAL_DECK);
    for (const e of p.deck) expect(Object.keys(e.travel).sort()).toEqual(["meera", "ravi", DEMO_YOU].sort());
    const all = p.deck.map((e) => ({ memberId: DEMO_YOU, placeId: e.place.id, liked: true }));
    expect(["winner", "tiebreak"]).toContain(decide(rank(p.deck, [...all, ...friendSwipes(p.deck)])).kind);
  });

  it("someone starting far outside the sample area gets too few places, which triggers the fallback", () => {
    const far: DemoYou = { ...priya, areaName: "Yelahanka", start: { lat: 13.1007, lng: 77.5963 }, prefs: { ...priya.prefs, maxTravelMin: 15 } };
    expect(buildDemoPool(demoGroup(far)).deck.length).toBeLessThan(MIN_PERSONAL_DECK);
  });
});
