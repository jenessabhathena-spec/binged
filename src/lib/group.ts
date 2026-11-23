import "server-only";
// The rules of a group plan from the server's side: who is looking at it, how it moves from "collecting answers"
// to "everyone swipes" to "decided", and what the results are. Pages and actions call these; the stores only
// save and load. Reads cookies and the clock: call inside <Suspense>, after `await connection()` (getCurrentUser does).
import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { config } from "@/config";
import { getCurrentUser, getPreferences, type CurrentUser } from "@/lib/auth";
import { groupStore } from "@/lib/group-store";
import { decide, rank, type Outcome, type Ranking, type TieBreak } from "@/lib/matching";
import { answeredMembers, toPoolMember, type Answers, type Member } from "@/lib/members";
import { sampleCandidates } from "@/lib/places/place";
import { buildPool, type PoolEntry } from "@/lib/pool";
import type { Plan } from "@/lib/plans";
import type { StoredSwipe } from "@/lib/demo-state";

export const guestCookieName = (planId: string) => `bg_${planId.replace(/-/g, "")}`;
export const guestCookieValue = (m: Member) => `${m.id}.${m.token}`;
export const guestCookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 14 * 24 * 3600 };

const sameSecret = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

// The organiser is a member too: their answers start from their profile and saved tastes (editable on /me).
export async function ensureOrganiserMember(plan: Plan, user: CurrentUser): Promise<Member> {
  const store = groupStore();
  const existing = await store.findByUser(plan.id, user.id);
  if (existing) return existing;
  const prefs = await getPreferences(user);
  const home = user.profile.home;
  const answers: Answers | null = home ? { ...prefs, start: home } : null;
  return store.addMember({ planId: plan.id, userId: user.id, firstName: user.profile.name.split(" ")[0], role: "organiser", answers }, Date.now());
}

export type Viewer = { plan: Plan; member: Member; isOrganiser: boolean; user: CurrentUser | null };

// Who is this person in this plan? A signed-in account (the organiser, or a friend who signed in) or a guest with
// the secret cookie they got when they joined. Anyone else gets null (the page shows "not found").
export async function getViewer(planId: string): Promise<Viewer | null> {
  const store = groupStore();
  const plan = await store.getPlan(planId);
  if (!plan) return null;
  const user = await getCurrentUser();
  if (user) {
    if (plan.organiserId === user.id) return { plan, member: await ensureOrganiserMember(plan, user), isOrganiser: true, user };
    const m = await store.findByUser(plan.id, user.id);
    if (m) return { plan, member: m, isOrganiser: false, user };
  }
  const raw = (await cookies()).get(guestCookieName(plan.id))?.value ?? "";
  const [id, token] = raw.split(".");
  if (id && token) {
    const m = await store.getMember(plan.id, id);
    if (m && !m.userId && sameSecret(m.token, token)) return { plan, member: m, isOrganiser: false, user };
  }
  return null;
}

// ---------- the deck and who has finished it ----------

export const deckOf = (plan: Plan): PoolEntry[] => plan.pool?.deck ?? [];

export type Progress = { voters: Member[]; doneIds: Set<string> };

export function progressOf(plan: Plan, members: Member[], swipes: StoredSwipe[]): Progress {
  const deckIds = deckOf(plan).map((e) => e.place.id);
  const voters = answeredMembers(members);
  const doneIds = new Set(
    voters.filter((m) => deckIds.every((id) => swipes.some((s) => s.memberId === m.id && s.placeId === id))).map((m) => m.id),
  );
  return { voters, doneIds };
}

// ---------- moving the plan along ----------

export type StartResult = { ok: true; plan: Plan } | { ok: false; reason: string };

// Builds the deck from everyone's answers and opens swiping. Safe to call twice: only the first one wins.
export async function startPicking(planId: string, now: number): Promise<StartResult> {
  const store = groupStore();
  const plan = await store.getPlan(planId);
  if (!plan) return { ok: false, reason: "Plan not found" };
  if (plan.status !== "collecting") return { ok: true, plan };
  const members = answeredMembers(await store.listMembers(planId));
  if (members.length < 2) return { ok: false, reason: "At least 2 people need to have answered before you can start." };
  const pool = buildPool(members.map((m) => toPoolMember(m)!), { searchMode: plan.searchMode, searchArea: plan.searchArea }, sampleCandidates());
  if (pool.deck.length === 0) {
    return { ok: false, reason: "No place fits everyone's travel limits and dealbreakers. Ask someone to allow a longer trip or drop a dealbreaker, then try again." };
  }
  const updated = await store.patchPlan(planId, { status: "group_swiping", pool, pickingStartedAt: now }, "collecting");
  return { ok: true, plan: updated ?? (await store.getPlan(planId))! };
}

// Called whenever a plan page loads: starts picking at the answers deadline, and closes voting when everyone has
// finished or the voting window is up. Returns the current plan.
export async function advance(planId: string, now: number): Promise<Plan | null> {
  const store = groupStore();
  let plan = await store.getPlan(planId);
  if (!plan) return null;
  if (plan.status === "collecting" && now >= plan.deadlineAt) {
    const members = answeredMembers(await store.listMembers(planId));
    if (members.length >= 2) {
      const r = await startPicking(planId, now);
      if (r.ok) plan = r.plan;
    }
  }
  if (plan.status === "group_swiping" && !plan.votingClosedAt) {
    const swipes = await store.listSwipes(planId);
    const { voters, doneIds } = progressOf(plan, await store.listMembers(planId), swipes);
    const everyoneDone = voters.length > 0 && voters.every((m) => doneIds.has(m.id));
    const expired = now >= (plan.pickingStartedAt ?? now) + config.voting.windowMinutes * 60_000;
    if (everyoneDone || expired) plan = (await store.patchPlan(planId, { votingClosedAt: now })) ?? plan;
  }
  return plan;
}

export async function closeVoting(planId: string, now: number): Promise<void> {
  const store = groupStore();
  const plan = await store.getPlan(planId);
  if (plan && plan.status === "group_swiping" && !plan.votingClosedAt) await store.patchPlan(planId, { votingClosedAt: now });
}

export type SwipeResult = { ok: true } | { ok: false; reason: string };

export async function recordSwipe(plan: Plan, member: Member, placeId: string, liked: boolean, now: number): Promise<SwipeResult> {
  if (plan.status !== "group_swiping" || plan.votingClosedAt) return { ok: false, reason: "Voting has closed" };
  if (member.answeredAt == null) return { ok: false, reason: "Answer the questions first" };
  if (!deckOf(plan).some((e) => e.place.id === placeId)) return { ok: false, reason: "That place isn't in your deck" };
  await groupStore().saveSwipe({ planId: plan.id, memberId: member.id, placeId, liked, at: now });
  return { ok: true };
}

// ---------- results ----------

export type Results = {
  plan: Plan;
  members: Member[];
  ranking: Ranking;
  outcome: Outcome;
  tie: { endsAt: number; voted: number; voters: number; myVote: string | null; closed: boolean } | null;
};

// The shortlist, and who wins. Creates the 60-second tie-break the first time it is needed, and saves the winner
// once it is known. Same swipes, same winner, every time.
export async function computeResults(planId: string, myMemberId: string, now: number): Promise<Results | null> {
  const store = groupStore();
  const plan = await advance(planId, now);
  if (!plan || !plan.pool) return null;
  const [members, swipes] = await Promise.all([store.listMembers(planId), store.listSwipes(planId)]);
  const ranking = rank(deckOf(plan), swipes.map((s) => ({ memberId: s.memberId, placeId: s.placeId, liked: s.liked })));

  let outcome = decide(ranking);
  let tie: Results["tie"] = null;
  let current = plan;

  if (outcome.kind === "tiebreak") {
    const ids: [string, string] = [outcome.options[0].entry.place.id, outcome.options[1].entry.place.id];
    let tb = plan.tiebreak;
    if (!tb || tb.optionIds[0] !== ids[0] || tb.optionIds[1] !== ids[1]) {
      tb = { optionIds: ids, endsAt: now + config.plan.tieBreakSeconds * 1000 };
      current = (await store.patchPlan(planId, { tiebreak: tb })) ?? current;
    }
    const votes = await store.listTieVotes(planId);
    const voterIds = ranking.participants;
    const closed = now >= tb.endsAt || voterIds.every((id) => votes[id]);
    const t: TieBreak = { optionIds: tb.optionIds, votes, closed, organiserChoice: tb.organiserChoice };
    outcome = decide(ranking, t);
    tie = { endsAt: tb.endsAt, voted: voterIds.filter((id) => votes[id]).length, voters: voterIds.length, myVote: votes[myMemberId] ?? null, closed };
  }

  if (outcome.kind === "winner" && current.winnerPlaceId !== outcome.winner.entry.place.id) {
    current = (await store.patchPlan(planId, { status: "decided", winnerPlaceId: outcome.winner.entry.place.id, winnerVia: outcome.via })) ?? current;
  }
  return { plan: current, members, ranking, outcome, tie };
}

export async function castTieVote(plan: Plan, member: Member, placeId: string, now: number): Promise<boolean> {
  const tb = plan.tiebreak;
  if (!tb || now >= tb.endsAt || !tb.optionIds.includes(placeId)) return false;
  await groupStore().saveTieVote(plan.id, member.id, placeId);
  return true;
}

export async function organiserChoose(plan: Plan, placeId: string): Promise<boolean> {
  const tb = plan.tiebreak;
  if (!tb || !tb.optionIds.includes(placeId)) return false;
  await groupStore().patchPlan(plan.id, { tiebreak: { ...tb, organiserChoice: placeId } });
  return true;
}

// Does this request carry a valid guest pass for ANY plan? Lets a friend who joined with just a first name use
// the area search (which can cost money when Google is on) without having an account. Checked against the store.
export async function hasGuestPass(): Promise<boolean> {
  const store = groupStore();
  for (const c of (await cookies()).getAll()) {
    const m = /^bg_([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/.exec(c.name);
    if (!m) continue;
    const [id, token] = c.value.split(".");
    if (!id || !token) continue;
    const member = await store.getMember(m.slice(1).join("-"), id);
    if (member && !member.userId && sameSecret(member.token, token)) return true;
  }
  return false;
}
