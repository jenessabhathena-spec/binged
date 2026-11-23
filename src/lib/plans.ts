// Plans (SPEC S5-S6): the shape, validation and wording. Pure: no React, no Node APIs, so the form, the server
// and the tests share one definition. All times are Bengaluru time (IST, UTC+5:30, no daylight saving).

import { config } from "@/config";
import { inCity, roundCoord } from "@/lib/areas";
import type { Pool } from "@/lib/pool";
import type { AreaPin } from "@/lib/profile";

export type SearchMode = "anywhere_fair" | "area";
export type PlanStatus = "collecting" | "organiser_swiping" | "group_swiping" | "decided" | "closed";

export type Plan = {
  id: string;
  organiserId: string;
  organiserFirstName: string;
  name: string;
  startsAt: number; // epoch ms
  searchMode: SearchMode;
  searchArea: AreaPin | null; // only for searchMode "area"
  partySize: number;
  deadlineAt: number; // epoch ms: when answers close
  status: PlanStatus;
  inviteCode: string;
  createdAt: number;
  // Set as the plan moves along (M4+). "group_swiping" = everyone is swiping the deck.
  pool?: Pool;
  pickingStartedAt?: number;
  votingClosedAt?: number;
  tiebreak?: { optionIds: [string, string]; endsAt: number; organiserChoice?: string };
  winnerPlaceId?: string;
  winnerVia?: "full_match" | "only_option" | "tiebreak" | "organiser";
};

// What anyone holding the invite link may see. Never the organiser's profile, area or preferences.
export type PublicPlan = { name: string; startsAt: number; organiserFirstName: string; partySize: number };

export const publicView = (p: Plan): PublicPlan => ({ name: p.name, startsAt: p.startsAt, organiserFirstName: p.organiserFirstName, partySize: p.partySize });

// ---------- time (IST) ----------

const IST_OFFSET_MS = 5.5 * 3600_000;
const MINUTE = 60_000, HOUR = 3600_000, DAY = 86_400_000;

export const istToEpoch = (date: string, time: string) => Date.parse(`${date}T${time}:00+05:30`);

export function todayIST(now: number): string {
  return new Date(now + IST_OFFSET_MS).toISOString().slice(0, 10);
}

// The next Friday (today counts if it is Friday and the default time is still ahead), as YYYY-MM-DD in IST.
export function nextFridayIST(now: number, time: string = config.plan.defaultTime): string {
  const ist = new Date(now + IST_OFFSET_MS);
  const today = ist.toISOString().slice(0, 10);
  const dow = ist.getUTCDay(); // 0 Sun .. 5 Fri
  let ahead = (5 - dow + 7) % 7;
  if (ahead === 0 && istToEpoch(today, time) < now + config.plan.minLeadMinutes * MINUTE) ahead = 7;
  return new Date(Date.parse(`${today}T00:00:00Z`) + ahead * DAY).toISOString().slice(0, 10);
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", ...opts });

// "Fri 28 Nov, 8:00 pm"
export function formatWhen(epoch: number): string {
  const d = fmt({ weekday: "short", day: "numeric", month: "short" }).format(epoch);
  const t = fmt({ hour: "numeric", minute: "2-digit", hour12: true }).format(epoch).toLowerCase();
  return `${d.replace(",", "")}, ${t}`;
}

export const formatDeadline = (epoch: number) => formatWhen(epoch);

export const hoursLabel = (h: number) => (h === 1 ? "1 hour" : h === 24 ? "1 day" : `${h} hours`);

// ---------- invite link ----------

export const inviteExpiresAt = (p: Pick<Plan, "startsAt">) => p.startsAt + config.plan.inviteValidAfterStartHours * HOUR;
export const inviteExpired = (p: Pick<Plan, "startsAt">, now: number) => now > inviteExpiresAt(p);
export const isActive = (p: Pick<Plan, "startsAt" | "status">, now: number) => p.status !== "closed" && !inviteExpired(p, now);

// Codes are 11 URL-safe characters from 64 random bits (made in the store). Anything else is not a code.
export const INVITE_CODE = /^[A-Za-z0-9_-]{11}$/;

export const inviteUrl = (origin: string, code: string) => `${origin.replace(/\/$/, "")}/j/${code}`;

// SPEC S6 wording, with the plan name filled in.
export const shareMessage = (planName: string, url: string) => `Join my Binged plan for ${planName} — takes 30 seconds: ${url}`;

export const whatsappUrl = (message: string) => `https://wa.me/?text=${encodeURIComponent(message)}`;

// ---------- validation ----------

export type PlanInput = {
  name: string; date: string; time: string; searchMode: string;
  searchArea: Partial<AreaPin> | null; partySize: string; deadlineHours: string;
};
export type PlanErrors = Partial<Record<"name" | "when" | "searchArea" | "partySize" | "deadline", string>>;
export type ValidPlan = { name: string; startsAt: number; searchMode: SearchMode; searchArea: AreaPin | null; partySize: number; deadlineAt: number };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validatePlan(input: PlanInput, now: number): { ok: true; value: ValidPlan } | { ok: false; errors: PlanErrors } {
  const errors: PlanErrors = {};
  const p = config.plan;

  const name = String(input.name ?? "").trim().replace(/\s+/g, " ");
  if (!name) errors.name = "Give your plan a name";
  else if (name.length > p.nameMaxLength) errors.name = `Keep the name under ${p.nameMaxLength} characters`;

  let startsAt = Number.NaN;
  if (!DATE.test(input.date ?? "") || !TIME.test(input.time ?? "")) errors.when = "Choose a date and a time";
  else {
    startsAt = istToEpoch(input.date, input.time);
    // Date.parse rolls impossible dates over (31 Feb becomes 3 Mar), so check it round-trips.
    if (Number.isNaN(startsAt) || todayIST(startsAt) !== input.date) errors.when = "That date doesn't exist";
    else if (startsAt < now + p.minLeadMinutes * MINUTE) errors.when = `Pick a time at least ${p.minLeadMinutes} minutes from now`;
    else if (startsAt > now + p.maxAdvanceDays * DAY) errors.when = `Plans can be up to ${p.maxAdvanceDays} days ahead`;
  }

  const mode = input.searchMode;
  let searchArea: AreaPin | null = null;
  if (mode !== "anywhere_fair" && mode !== "area") errors.searchArea = "Choose where to eat";
  else if (mode === "area") {
    const a = input.searchArea;
    const name = String(a?.name ?? "").trim().replace(/\s+/g, " ");
    if (!a || !name || name.length > 80 || !inCity(a)) errors.searchArea = "Choose an area in Bengaluru, or pick Anywhere fair";
    else searchArea = { name, lat: roundCoord(a.lat as number), lng: roundCoord(a.lng as number) };
  }

  const size = /^\d{1,2}$/.test(String(input.partySize)) ? Number(input.partySize) : Number.NaN;
  if (!Number.isInteger(size) || size < p.minPartySize || size > p.maxPartySize) errors.partySize = `Choose between ${p.minPartySize} and ${p.maxPartySize} people`;

  const hours = /^\d{1,2}$/.test(String(input.deadlineHours)) ? Number(input.deadlineHours) : Number.NaN;
  let deadlineAt = Number.NaN;
  if (!(p.deadlineHoursOptions as readonly number[]).includes(hours)) errors.deadline = "Choose a response window from the list";
  else {
    deadlineAt = now + hours * HOUR;
    if (!Number.isNaN(startsAt) && !errors.when && deadlineAt > startsAt - p.deadlineBufferMinutes * MINUTE) {
      errors.deadline = "The plan starts before that response window ends. Choose a shorter one, or a later time.";
    }
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name, startsAt, searchMode: mode as SearchMode, searchArea, partySize: size, deadlineAt } };
}

// Reads the form the create page submits (the AreaPicker writes searchName / searchLat / searchLng).
export function planInputFromForm(fd: FormData): PlanInput {
  const name = fd.get("searchName"), lat = fd.get("searchLat"), lng = fd.get("searchLng");
  const area = !name && !lat && !lng ? null : { name: String(name ?? ""), lat: lat === null || lat === "" ? undefined : Number(lat), lng: lng === null || lng === "" ? undefined : Number(lng) };
  return {
    name: String(fd.get("name") ?? ""), date: String(fd.get("date") ?? ""), time: String(fd.get("time") ?? ""),
    searchMode: String(fd.get("searchMode") ?? ""), searchArea: area,
    partySize: String(fd.get("partySize") ?? ""), deadlineHours: String(fd.get("deadlineHours") ?? ""),
  };
}
