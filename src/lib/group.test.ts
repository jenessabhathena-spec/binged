import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// group.ts reads cookies and the signed-in user only in getViewer; the rules under test don't, so stub those modules.
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => null, getPreferences: async () => ({}) }));

import { advance, closeVoting, computeResults, deckOf, castTieVote, organiserChoose, progressOf, recordSwipe, startPicking } from "@/lib/group";
import { groupStore } from "@/lib/group-store";
import { planStore } from "@/lib/plan-store";
import type { Answers } from "@/lib/members";
import type { ValidPlan } from "@/lib/plans";

const HOUR = 3600_000, MIN = 60_000;
const NOW = Date.parse("2026-11-23T10:00:00+05:30");
const plan: ValidPlan = { name: "Friday dinner", startsAt: NOW + 4 * 24 * HOUR, searchMode: "anywhere_fair", searchArea: null, partySize: 4, deadlineAt: NOW + 2 * HOUR };

const ans = (name: string, lat: number, lng: number, over: Partial<Answers> = {}): Answers => ({
  start: { name, lat, lng }, budgetPerPerson: 1500, cuisines: [], diet: null, spice: null, vibes: [], dealbreakers: [], maxTravelMin: 40, ...over,
});

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "binged-group-"));
  vi.stubEnv("DEMO_DATA_DIR", dir);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

// A plan with Asha (organiser), Ravi and Meera, all answered.
async function setup(opts: { answered?: number } = {}) {
  const p = await planStore().create({ id: "u-asha", firstName: "Asha" }, plan, NOW);
  const g = groupStore();
  const n = opts.answered ?? 3;
  const a = (i: number, x: Answers) => (i < n ? x : null); // people beyond the first n joined but haven't answered
  const people = [
    await g.addMember({ planId: p.id, userId: "u-asha", firstName: "Asha", role: "organiser", answers: a(0, ans("Indiranagar", 12.9784, 77.6408, { budgetPerPerson: 1500 })) }, NOW),
    await g.addMember({ planId: p.id, userId: null, firstName: "Ravi", role: "member", answers: a(1, ans("Koramangala", 12.9352, 77.6245, { budgetPerPerson: 777 })) }, NOW),
    await g.addMember({ planId: p.id, userId: null, firstName: "Meera", role: "member", answers: a(2, ans("HSR Layout", 12.9116, 77.6474)) }, NOW),
  ];
  return { p, g, people };
}

describe("starting the picking", () => {
  it("needs at least 2 people who have answered", async () => {
    const p = await planStore().create({ id: "u-asha", firstName: "Asha" }, plan, NOW);
    await groupStore().addMember({ planId: p.id, userId: "u-asha", firstName: "Asha", role: "organiser", answers: ans("Indiranagar", 12.9784, 77.6408) }, NOW);
    const r = await startPicking(p.id, NOW);
    expect(r.ok).toBe(false);
    expect((await groupStore().getPlan(p.id))?.status).toBe("collecting");
  });

  it("builds a deck of at least 10 places, saves it with the plan, and moves to group swiping", async () => {
    const { p } = await setup();
    const r = await startPicking(p.id, NOW);
    expect(r.ok).toBe(true);
    const saved = (await groupStore().getPlan(p.id))!;
    expect(saved.status).toBe("group_swiping");
    expect(deckOf(saved).length).toBeGreaterThanOrEqual(10);
    expect(saved.pickingStartedAt).toBe(NOW);
  });

  it("never writes anyone's budget into the plan's saved deck", async () => {
    const { p } = await setup();
    await startPicking(p.id, NOW);
    const saved = JSON.stringify((await groupStore().getPlan(p.id))!.pool);
    expect(saved).not.toContain("777");
    expect(saved).not.toContain("1500");
  });

  it("is safe to call twice: the deck is built once", async () => {
    const { p } = await setup();
    await startPicking(p.id, NOW);
    const first = (await groupStore().getPlan(p.id))!.pool;
    await startPicking(p.id, NOW + MIN);
    expect((await groupStore().getPlan(p.id))!.pool).toEqual(first);
  });

  it("starts by itself at the answers deadline when 2+ have answered, and leaves out anyone who hasn't", async () => {
    const { p, g } = await setup({ answered: 2 });
    await g.addMember({ planId: p.id, userId: null, firstName: "Late", role: "member", answers: null }, NOW);
    expect((await advance(p.id, NOW + HOUR))?.status).toBe("collecting"); // before the deadline
    expect((await advance(p.id, p.deadlineAt + MIN))?.status).toBe("group_swiping");
    const { voters } = progressOf((await g.getPlan(p.id))!, await g.listMembers(p.id), []);
    expect(voters.map((m) => m.firstName)).toEqual(["Asha", "Ravi"]);
  });

  it("explains when no place fits anyone's limits", async () => {
    const p = await planStore().create({ id: "u-asha", firstName: "Asha" }, plan, NOW);
    const g = groupStore();
    await g.addMember({ planId: p.id, userId: "u-asha", firstName: "Asha", role: "organiser", answers: ans("Indiranagar", 12.9784, 77.6408, { maxTravelMin: 15 }) }, NOW);
    await g.addMember({ planId: p.id, userId: null, firstName: "Far", role: "member", answers: ans("Yelahanka", 13.1007, 77.5963, { maxTravelMin: 15 }) }, NOW);
    const r = await startPicking(p.id, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/No place fits/);
  });
});

describe("swiping and closing", () => {
  it("accepts swipes on deck places only, and none after voting closes", async () => {
    const { p, people } = await setup();
    await startPicking(p.id, NOW);
    const live = (await groupStore().getPlan(p.id))!;
    const first = deckOf(live)[0].place.id;
    expect((await recordSwipe(live, people[0], first, true, NOW)).ok).toBe(true);
    expect((await recordSwipe(live, people[0], "not-in-deck", true, NOW)).ok).toBe(false);
    await closeVoting(p.id, NOW + MIN);
    const closed = (await groupStore().getPlan(p.id))!;
    expect((await recordSwipe(closed, people[0], first, false, NOW + MIN)).ok).toBe(false);
  });

  it("a repeated swipe replaces the earlier one; undo removes the latest", async () => {
    const { p, people, g } = await setup();
    await startPicking(p.id, NOW);
    const live = (await g.getPlan(p.id))!;
    const [a, b] = deckOf(live).map((e) => e.place.id);
    await recordSwipe(live, people[0], a, true, NOW);
    await recordSwipe(live, people[0], a, false, NOW + 1);
    await recordSwipe(live, people[0], b, true, NOW + 2);
    expect((await g.listSwipes(p.id)).filter((s) => s.placeId === a)).toHaveLength(1);
    expect(await g.undoLastSwipe(p.id, people[0].id)).toBe(b);
    expect((await g.listSwipes(p.id)).map((s) => s.placeId)).toEqual([a]);
  });

  it("closes voting once everyone has swiped every card", async () => {
    const { p, people, g } = await setup();
    await startPicking(p.id, NOW);
    const live = (await g.getPlan(p.id))!;
    for (const m of people) for (const e of deckOf(live)) await recordSwipe(live, m, e.place.id, true, NOW);
    expect((await advance(p.id, NOW + MIN))?.votingClosedAt).toBe(NOW + MIN);
  });

  it("closes voting when the window runs out, using whatever has been swiped", async () => {
    const { p } = await setup();
    await startPicking(p.id, NOW);
    expect((await advance(p.id, NOW + 10 * MIN))?.votingClosedAt).toBeUndefined();
    expect((await advance(p.id, NOW + 46 * MIN))?.votingClosedAt).toBe(NOW + 46 * MIN);
  });
});

describe("results", () => {
  async function voted(rule: (memberIdx: number, placeIdx: number) => boolean) {
    const { p, people, g } = await setup();
    await startPicking(p.id, NOW);
    const live = (await g.getPlan(p.id))!;
    const deck = deckOf(live);
    for (const [mi, m] of people.entries()) for (const [pi, e] of deck.entries()) await recordSwipe(live, m, e.place.id, rule(mi, pi), NOW);
    await advance(p.id, NOW + MIN);
    return { p, people, g, deck };
  }

  it("a place everyone liked wins, is saved on the plan, and the same swipes always give the same winner", async () => {
    const { p, people, deck } = await voted((_m, pi) => pi === 3 || pi === 5);
    const a = await computeResults(p.id, people[0].id, NOW + 2 * MIN);
    const b = await computeResults(p.id, people[1].id, NOW + 3 * MIN);
    expect(a?.outcome.kind).toBe("winner");
    if (a?.outcome.kind !== "winner" || b?.outcome.kind !== "winner") throw new Error("expected winners");
    expect(a.outcome.winner.entry.place.id).toBe(b.outcome.winner.entry.place.id);
    expect([deck[3].place.id, deck[5].place.id]).toContain(a.outcome.winner.entry.place.id);
    const saved = (await groupStore().getPlan(p.id))!;
    expect(saved.status).toBe("decided");
    expect(saved.winnerPlaceId).toBe(a.outcome.winner.entry.place.id);
    expect(saved.winnerVia).toBe("full_match");
  });

  it("with no full match, opens a 60-second vote between the top two", async () => {
    // Asha likes 0,1; Ravi likes 1,2; Meera likes 2,0: each of 0, 1, 2 has two yes votes.
    const { p, people } = await voted((mi, pi) => [[0, 1], [1, 2], [2, 0]][mi].includes(pi));
    const r = await computeResults(p.id, people[0].id, NOW + 2 * MIN);
    expect(r?.outcome.kind).toBe("tiebreak");
    expect(r?.tie).toMatchObject({ endsAt: NOW + 3 * MIN, voted: 0, voters: 3, closed: false });
    expect((await groupStore().getPlan(p.id))?.status).toBe("group_swiping"); // not decided yet
  });

  it("the vote closes when everyone has voted; the majority wins", async () => {
    const { p, people, g } = await voted((mi, pi) => [[0, 1], [1, 2], [2, 0]][mi].includes(pi));
    const open = await computeResults(p.id, people[0].id, NOW + 2 * MIN);
    if (open?.outcome.kind !== "tiebreak") throw new Error("expected a tie-break");
    const [a, b] = open.outcome.options.map((o) => o.entry.place.id);
    const live = (await g.getPlan(p.id))!;
    expect(await castTieVote(live, people[0], a, NOW + 2 * MIN)).toBe(true);
    expect(await castTieVote(live, people[1], b, NOW + 2 * MIN)).toBe(true);
    expect(await castTieVote(live, people[2], b, NOW + 2 * MIN)).toBe(true);
    const done = await computeResults(p.id, people[0].id, NOW + 2 * MIN);
    expect(done?.outcome.kind === "winner" && done.outcome.winner.entry.place.id).toBe(b);
    expect((await g.getPlan(p.id))?.winnerVia).toBe("tiebreak");
  });

  it("rejects a vote for a place that isn't one of the two, and a late vote", async () => {
    const { p, people, g } = await voted((mi, pi) => [[0, 1], [1, 2], [2, 0]][mi].includes(pi));
    const open = await computeResults(p.id, people[0].id, NOW + 2 * MIN);
    if (open?.outcome.kind !== "tiebreak") throw new Error("expected a tie-break");
    const live = (await g.getPlan(p.id))!;
    expect(await castTieVote(live, people[0], "something-else", NOW + 2 * MIN)).toBe(false);
    expect(await castTieVote(live, people[0], open.outcome.options[0].entry.place.id, NOW + 4 * MIN)).toBe(false);
  });

  it("a tied vote goes to the organiser, whose pick wins", async () => {
    const { p, people, g } = await voted((mi, pi) => [[0, 1], [1, 2], [2, 0]][mi].includes(pi));
    const open = await computeResults(p.id, people[0].id, NOW + 2 * MIN);
    if (open?.outcome.kind !== "tiebreak") throw new Error("expected a tie-break");
    const [a, b] = open.outcome.options.map((o) => o.entry.place.id);
    await castTieVote((await g.getPlan(p.id))!, people[0], a, NOW + 2 * MIN);
    await castTieVote((await g.getPlan(p.id))!, people[1], b, NOW + 2 * MIN);
    const tied = await computeResults(p.id, people[0].id, NOW + 5 * MIN); // time is up, one vote each, one abstained
    expect(tied?.outcome.kind).toBe("organiser_decides");
    expect(await organiserChoose((await g.getPlan(p.id))!, b)).toBe(true);
    const final = await computeResults(p.id, people[0].id, NOW + 6 * MIN);
    expect(final?.outcome.kind === "winner" && final.outcome.winner.entry.place.id).toBe(b);
    expect((await g.getPlan(p.id))?.winnerVia).toBe("organiser");
  });

  it("nobody liking anything is reported, not crashed on", async () => {
    const { p, people } = await voted(() => false);
    expect((await computeResults(p.id, people[0].id, NOW + 2 * MIN))?.outcome.kind).toBe("no_match");
  });

  it("keeps budgets out of everything saved on disk except the members' own private answers", async () => {
    const { p } = await voted(() => true);
    await computeResults(p.id, "x", NOW + 2 * MIN);
    const state = JSON.parse(readFileSync(join(dir, "plans.json"), "utf8"));
    expect(JSON.stringify(state.plans)).not.toContain("777");
  });
});
