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
