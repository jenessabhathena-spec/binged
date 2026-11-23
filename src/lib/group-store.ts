import "server-only";
// Everything that happens inside a plan after it is created: members and their answers, swipes, tie-break votes
// and the plan's progress (deck, winner). Two implementations behind one interface:
//  - the local demo file (no Supabase yet);
//  - Supabase through the SERVICE role, because guests have no account. The app code authorises every call
//    first (see group.ts). The tables themselves have Row Level Security with no public policies, so a browser
//    holding only the anon key can read nothing; a member's budget lives in its own table, readable only by that
//    member's own account (migration 0004).
import { randomBytes, randomUUID } from "node:crypto";
import { mutate, readState, type StoredSwipe } from "@/lib/demo-state";
import { isSupabaseConfigured } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";
import type { Answers, Member } from "@/lib/members";
import { planFromRow, type PlanRow } from "@/lib/plan-store";
import type { Plan } from "@/lib/plans";

export type PlanPatch = Partial<Pick<Plan, "status" | "pool" | "pickingStartedAt" | "votingClosedAt" | "tiebreak" | "winnerPlaceId" | "winnerVia">>;
export type NewMember = { planId: string; userId: string | null; firstName: string; role: Member["role"]; answers: Answers | null };

export interface GroupStore {
  getPlan(planId: string): Promise<Plan | null>;
  // Changes the plan. With ifStatus it only applies if the plan is still in that status (so two people tapping
  // "start" at once build the deck once). Returns the updated plan, or null if the condition didn't hold.
  patchPlan(planId: string, patch: PlanPatch, ifStatus?: Plan["status"]): Promise<Plan | null>;
  listMembers(planId: string): Promise<Member[]>;
  getMember(planId: string, memberId: string): Promise<Member | null>;
  findByUser(planId: string, userId: string): Promise<Member | null>;
  addMember(m: NewMember, now: number): Promise<Member>;
  saveAnswers(planId: string, memberId: string, answers: Answers, now: number): Promise<void>;
  listSwipes(planId: string): Promise<StoredSwipe[]>;
  saveSwipe(s: StoredSwipe): Promise<void>; // one swipe per member per place: a repeat replaces it
  undoLastSwipe(planId: string, memberId: string): Promise<string | null>; // the place whose swipe was undone
  listTieVotes(planId: string): Promise<Record<string, string>>; // memberId -> placeId
  saveTieVote(planId: string, memberId: string, placeId: string): Promise<void>;
}

const newToken = () => randomBytes(24).toString("base64url");

// ---------- local file (demo) ----------

const fileGroup: GroupStore = {
  async getPlan(planId) { return readState().plans.find((p) => p.id === planId) ?? null; },
  async patchPlan(planId, patch, ifStatus) {
    return mutate((s) => {
      const p = s.plans.find((x) => x.id === planId);
      if (!p || (ifStatus && p.status !== ifStatus)) return null;
      Object.assign(p, patch);
      return { ...p };
    });
  },
  async listMembers(planId) { return readState().members.filter((m) => m.planId === planId).sort((a, b) => a.joinedAt - b.joinedAt); },
  async getMember(planId, memberId) { return readState().members.find((m) => m.planId === planId && m.id === memberId) ?? null; },
  async findByUser(planId, userId) { return readState().members.find((m) => m.planId === planId && m.userId === userId) ?? null; },
  async addMember(m, now) {
    return mutate((s) => {
      const member: Member = { id: randomUUID(), planId: m.planId, userId: m.userId, firstName: m.firstName, role: m.role, joinedAt: now, answeredAt: m.answers ? now : null, answers: m.answers, token: newToken() };
      s.members.push(member);
      return member;
    });
  },
  async saveAnswers(planId, memberId, answers, now) {
    mutate((s) => {
      const m = s.members.find((x) => x.planId === planId && x.id === memberId);
      if (m) { m.answers = answers; m.answeredAt = now; }
    });
  },
  async listSwipes(planId) { return readState().swipes.filter((x) => x.planId === planId); },
  async saveSwipe(sw) {
    mutate((s) => {
      s.swipes = s.swipes.filter((x) => !(x.planId === sw.planId && x.memberId === sw.memberId && x.placeId === sw.placeId));
      s.swipes.push(sw);
    });
  },
  async undoLastSwipe(planId, memberId) {
    return mutate((s) => {
      const mine = s.swipes.filter((x) => x.planId === planId && x.memberId === memberId);
      const last = mine.sort((a, b) => b.at - a.at)[0];
      if (!last) return null;
      s.swipes = s.swipes.filter((x) => x !== last && !(x.planId === planId && x.memberId === memberId && x.placeId === last.placeId));
      return last.placeId;
    });
  },
  async listTieVotes(planId) {
    return Object.fromEntries(readState().tieVotes.filter((v) => v.planId === planId).map((v) => [v.memberId, v.placeId]));
  },
  async saveTieVote(planId, memberId, placeId) {
    mutate((s) => {
      s.tieVotes = s.tieVotes.filter((v) => !(v.planId === planId && v.memberId === memberId));
      s.tieVotes.push({ planId, memberId, placeId });
    });
  },
};

// ---------- Supabase ----------

type MemberRow = {
  id: string; plan_id: string; user_id: string | null; first_name: string; role: Member["role"]; joined_at: string;
  answered_at: string | null; token: string;
  plan_member_private: null | {
    start_name: string; start_lat: number; start_lng: number; budget: number | null; cuisines: string[]; diet: string | null;
    spice: string | null; vibes: string[]; dealbreakers: string[]; max_travel_min: number;
  } | Array<unknown>;
};

const memberFromRow = (r: MemberRow): Member => {
  const p = Array.isArray(r.plan_member_private) ? (r.plan_member_private[0] as Exclude<MemberRow["plan_member_private"], null | Array<unknown>> | undefined) : r.plan_member_private;
  return {
    id: r.id, planId: r.plan_id, userId: r.user_id, firstName: r.first_name, role: r.role, joinedAt: Date.parse(r.joined_at),
    answeredAt: r.answered_at ? Date.parse(r.answered_at) : null, token: r.token,
    answers: p ? {
      start: { name: p.start_name, lat: p.start_lat, lng: p.start_lng },
      budgetPerPerson: p.budget, cuisines: p.cuisines ?? [], diet: p.diet as Answers["diet"], spice: p.spice as Answers["spice"],
      vibes: p.vibes ?? [], dealbreakers: (p.dealbreakers ?? []) as Answers["dealbreakers"], maxTravelMin: p.max_travel_min,
    } : null,
  };
};

const privateRow = (memberId: string, a: Answers) => ({
  member_id: memberId, start_name: a.start.name, start_lat: a.start.lat, start_lng: a.start.lng, budget: a.budgetPerPerson,
  cuisines: a.cuisines, diet: a.diet, spice: a.spice, vibes: a.vibes, dealbreakers: a.dealbreakers, max_travel_min: a.maxTravelMin,
});

const planColumns = (p: PlanPatch) => ({
  ...(p.status !== undefined ? { status: p.status } : {}),
  ...(p.pool !== undefined ? { pool: p.pool } : {}),
  ...(p.pickingStartedAt !== undefined ? { picking_started_at: new Date(p.pickingStartedAt).toISOString() } : {}),
  ...(p.votingClosedAt !== undefined ? { voting_closed_at: new Date(p.votingClosedAt).toISOString() } : {}),
  ...(p.tiebreak !== undefined ? { tiebreak: p.tiebreak } : {}),
  ...(p.winnerPlaceId !== undefined ? { winner_place_id: p.winnerPlaceId } : {}),
  ...(p.winnerVia !== undefined ? { winner_via: p.winnerVia } : {}),
});

function db() {
  const c = createServiceClient();
  if (!c) throw new Error("SUPABASE_SERVICE_ROLE_KEY is needed to run group plans");
  return c;
}

const MEMBER_SELECT = "*, plan_member_private(*)";

const supabaseGroup: GroupStore = {
  async getPlan(planId) {
    const { data } = await db().from("plans").select("*").eq("id", planId).maybeSingle<PlanRow>();
    return data ? planFromRow(data) : null;
  },
  async patchPlan(planId, patch, ifStatus) {
    let q = db().from("plans").update(planColumns(patch)).eq("id", planId);
    if (ifStatus) q = q.eq("status", ifStatus);
    const { data } = await q.select().maybeSingle<PlanRow>();
    return data ? planFromRow(data) : null;
  },
  async listMembers(planId) {
    const { data } = await db().from("plan_members").select(MEMBER_SELECT).eq("plan_id", planId).order("joined_at").returns<MemberRow[]>();
    return (data ?? []).map(memberFromRow);
  },
  async getMember(planId, memberId) {
    const { data } = await db().from("plan_members").select(MEMBER_SELECT).eq("plan_id", planId).eq("id", memberId).maybeSingle<MemberRow>();
    return data ? memberFromRow(data) : null;
  },
  async findByUser(planId, userId) {
    const { data } = await db().from("plan_members").select(MEMBER_SELECT).eq("plan_id", planId).eq("user_id", userId).maybeSingle<MemberRow>();
    return data ? memberFromRow(data) : null;
  },
  async addMember(m, now) {
    const { data, error } = await db().from("plan_members").insert({
      plan_id: m.planId, user_id: m.userId, first_name: m.firstName, role: m.role, token: newToken(),
      answered_at: m.answers ? new Date(now).toISOString() : null,
    }).select().single<MemberRow>();
    if (error || !data) throw new Error("Couldn't add you to the plan");
    if (m.answers) await db().from("plan_member_private").upsert(privateRow(data.id, m.answers));
    return memberFromRow({ ...data, plan_member_private: m.answers ? privateRow(data.id, m.answers) : null });
  },
  async saveAnswers(planId, memberId, answers, now) {
    const c = db();
    const { error } = await c.from("plan_member_private").upsert(privateRow(memberId, answers));
    if (error) throw new Error("Couldn't save your answers");
    await c.from("plan_members").update({ answered_at: new Date(now).toISOString() }).eq("id", memberId).eq("plan_id", planId);
  },
  async listSwipes(planId) {
    const { data } = await db().from("swipes").select("*").eq("plan_id", planId).returns<{ plan_id: string; member_id: string; place_id: string; liked: boolean; at: string }[]>();
    return (data ?? []).map((r) => ({ planId: r.plan_id, memberId: r.member_id, placeId: r.place_id, liked: r.liked, at: Date.parse(r.at) }));
  },
  async saveSwipe(s) {
    const { error } = await db().from("swipes").upsert({ plan_id: s.planId, member_id: s.memberId, place_id: s.placeId, liked: s.liked, at: new Date(s.at).toISOString() });
    if (error) throw new Error("Couldn't save your swipe");
  },
  async undoLastSwipe(planId, memberId) {
    const c = db();
    const { data } = await c.from("swipes").select("place_id").eq("plan_id", planId).eq("member_id", memberId).order("at", { ascending: false }).limit(1).maybeSingle<{ place_id: string }>();
    if (!data) return null;
    await c.from("swipes").delete().eq("plan_id", planId).eq("member_id", memberId).eq("place_id", data.place_id);
    return data.place_id;
  },
  async listTieVotes(planId) {
    const { data } = await db().from("tiebreak_votes").select("member_id, place_id").eq("plan_id", planId).returns<{ member_id: string; place_id: string }[]>();
    return Object.fromEntries((data ?? []).map((r) => [r.member_id, r.place_id]));
  },
  async saveTieVote(planId, memberId, placeId) {
    await db().from("tiebreak_votes").upsert({ plan_id: planId, member_id: memberId, place_id: placeId });
  },
};

export const groupStore = (): GroupStore => (isSupabaseConfigured() ? supabaseGroup : fileGroup);
