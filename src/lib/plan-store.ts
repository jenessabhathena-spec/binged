import "server-only";
// Where plans live. Two implementations behind one interface:
//  - Supabase (real): the organiser's own plans through Row Level Security; invite lookups with the service role.
//  - A local JSON file (demo, no Supabase yet): so an invite link can be opened in a different browser, which a
//    cookie cannot do. It is for local development only and refuses to run in production.
import { randomBytes, randomUUID } from "node:crypto";
import { mutate, readState } from "@/lib/demo-state";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { inviteExpired, isActive, type Plan, type ValidPlan } from "@/lib/plans";

export type Organiser = { id: string; firstName: string };

export interface PlanStore {
  create(o: Organiser, v: ValidPlan, now: number): Promise<Plan>;
  listActive(organiserId: string, now: number): Promise<Plan[]>;
  getOwned(planId: string, organiserId: string): Promise<Plan | null>;
  getByInvite(code: string, now: number): Promise<Plan | null>; // null if unknown or expired
  countSince(organiserId: string, since: number): Promise<number>;
}

const newInviteCode = () => randomBytes(8).toString("base64url"); // 11 URL-safe characters, 64 random bits

// ---------- local file (demo) ----------

const fileStore: PlanStore = {
  async create(o, v, now) {
    return await mutate((st) => {
      let inviteCode = newInviteCode();
      while (st.plans.some((p) => p.inviteCode === inviteCode)) inviteCode = newInviteCode();
      const plan: Plan = {
        id: randomUUID(), organiserId: o.id, organiserFirstName: o.firstName, name: v.name, startsAt: v.startsAt,
        searchMode: v.searchMode, searchArea: v.searchArea, partySize: v.partySize, deadlineAt: v.deadlineAt,
        status: "collecting", inviteCode, createdAt: now,
      };
      st.plans.push(plan);
      return plan;
    });
  },
  async listActive(organiserId, now) {
    return (await readState()).plans.filter((p) => p.organiserId === organiserId && isActive(p, now)).sort((a, b) => a.startsAt - b.startsAt);
  },
  async getOwned(planId, organiserId) {
    return (await readState()).plans.find((p) => p.id === planId && p.organiserId === organiserId) ?? null;
  },
  async getByInvite(code, now) {
    const p = (await readState()).plans.find((x) => x.inviteCode === code);
    return p && !inviteExpired(p, now) && p.status !== "closed" ? p : null;
  },
  async countSince(organiserId, since) {
    return (await readState()).plans.filter((p) => p.organiserId === organiserId && p.createdAt >= since).length;
  },
};

// ---------- Supabase ----------

export type PlanRow = {
  id: string; organiser_id: string; organiser_first_name: string; name: string; starts_at: string;
  search_mode: "anywhere_fair" | "area"; search_area_name: string | null; search_lat: number | null; search_lng: number | null;
  party_size: number; deadline_at: string; status: Plan["status"]; invite_code: string; created_at: string;
  pool: Plan["pool"] | null; picking_started_at: string | null; voting_closed_at: string | null;
  tiebreak: Plan["tiebreak"] | null; winner_place_id: string | null; winner_via: Plan["winnerVia"] | null;
};

export const planFromRow = (r: PlanRow): Plan => ({
  id: r.id, organiserId: r.organiser_id, organiserFirstName: r.organiser_first_name, name: r.name,
  startsAt: Date.parse(r.starts_at), searchMode: r.search_mode,
  searchArea: r.search_area_name && r.search_lat != null && r.search_lng != null ? { name: r.search_area_name, lat: r.search_lat, lng: r.search_lng } : null,
  partySize: r.party_size, deadlineAt: Date.parse(r.deadline_at), status: r.status, inviteCode: r.invite_code, createdAt: Date.parse(r.created_at),
  ...(r.pool ? { pool: r.pool } : {}),
  ...(r.picking_started_at ? { pickingStartedAt: Date.parse(r.picking_started_at) } : {}),
  ...(r.voting_closed_at ? { votingClosedAt: Date.parse(r.voting_closed_at) } : {}),
  ...(r.tiebreak ? { tiebreak: r.tiebreak } : {}),
  ...(r.winner_place_id ? { winnerPlaceId: r.winner_place_id } : {}),
  ...(r.winner_via ? { winnerVia: r.winner_via } : {}),
});

const supabaseStore: PlanStore = {
  async create(o, v) {
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase is not configured");
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase.from("plans").insert({
        organiser_id: o.id, organiser_first_name: o.firstName, name: v.name, starts_at: new Date(v.startsAt).toISOString(),
        search_mode: v.searchMode, search_area_name: v.searchArea?.name ?? null, search_lat: v.searchArea?.lat ?? null, search_lng: v.searchArea?.lng ?? null,
        party_size: v.partySize, deadline_at: new Date(v.deadlineAt).toISOString(), invite_code: newInviteCode(),
      }).select().single<PlanRow>();
      if (!error) return planFromRow(data);
      if (error.code !== "23505") throw new Error("Couldn't create the plan"); // only an invite-code clash is worth retrying
    }
    throw new Error("Couldn't create the plan");
  },
  async listActive(organiserId, now) {
    const supabase = await createClient();
    if (!supabase) return [];
    const { data } = await supabase.from("plans").select("*").eq("organiser_id", organiserId).neq("status", "closed").order("starts_at").returns<PlanRow[]>();
    return (data ?? []).map(planFromRow).filter((p) => isActive(p, now));
  },
  async getOwned(planId, organiserId) {
    const supabase = await createClient();
    if (!supabase) return null;
    const { data } = await supabase.from("plans").select("*").eq("id", planId).eq("organiser_id", organiserId).maybeSingle<PlanRow>();
    return data ? planFromRow(data) : null;
  },
  async getByInvite(code, now) {
    const service = createServiceClient();
    if (!service) throw new Error("SUPABASE_SERVICE_ROLE_KEY is needed to open invite links");
    const { data } = await service.from("plans").select("*").eq("invite_code", code).maybeSingle<PlanRow>();
    const p = data ? planFromRow(data) : null;
    return p && !inviteExpired(p, now) && p.status !== "closed" ? p : null;
  },
  async countSince(organiserId, since) {
    const supabase = await createClient();
    if (!supabase) return 0;
    const { count } = await supabase.from("plans").select("id", { count: "exact", head: true }).eq("organiser_id", organiserId).gte("created_at", new Date(since).toISOString());
    return count ?? 0;
  },
};

export const planStore = (): PlanStore => (isSupabaseConfigured() ? supabaseStore : fileStore);
