// Plan members (SPEC S7-S8): who is in a plan and what they told us. Pure: no React, no Node APIs.
//
// A member's answers (start area, budget, dealbreakers...) are PRIVATE. The lobby, the cards and the results only
// ever get LobbyMember (first name, role, "has answered"), never the answers.

import { parsePreferences, type Preferences, type PreferencesErrors } from "@/lib/preferences";
import { cleanPin, type AreaPin } from "@/lib/profile";
import type { PoolMember } from "@/lib/pool";
import { config } from "@/config";

export type Answers = Preferences & { start: AreaPin };

export type Member = {
  id: string;
  planId: string;
  userId: string | null; // null = a guest who joined with just a first name
  firstName: string;
  role: "organiser" | "member";
  joinedAt: number;
  answeredAt: number | null;
  answers: Answers | null; // PRIVATE
  token: string; // a guest's secret, kept in their cookie. Never sent to anyone else.
};

export type LobbyMember = { id: string; firstName: string; role: Member["role"]; answered: boolean; isYou: boolean };

export const lobbyView = (members: Member[], youId: string | null): LobbyMember[] =>
  members.map((m) => ({ id: m.id, firstName: m.firstName, role: m.role, answered: m.answeredAt != null, isYou: m.id === youId }));

// Letters (any language), spaces, apostrophes, dots and hyphens. No digits, symbols or markup.
const FIRST_NAME = /^[\p{L}\p{M}][\p{L}\p{M} '.\-]*$/u;

export function validateFirstName(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const name = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "Enter your first name" };
  if (name.length > config.members.firstNameMax) return { ok: false, error: `Keep it under ${config.members.firstNameMax} characters` };
  if (!FIRST_NAME.test(name)) return { ok: false, error: "Use letters only, please" };
  return { ok: true, value: name };
}

export const firstNameOf = (full: string) => full.trim().split(/\s+/)[0] ?? "";

export type AnswersErrors = PreferencesErrors & { start?: string };

// The 30-second form: where you'll start from (area or map pin, never a street address) plus the preference
// questions. Everything but the start area is optional.
export function parseAnswers(fd: FormData): { ok: true; value: Answers } | { ok: false; errors: AnswersErrors } {
  const errors: AnswersErrors = {};
  const name = fd.get("startName"), lat = fd.get("startLat"), lng = fd.get("startLng");
  const pin = cleanPin(
    !name && !lat && !lng ? null : { name: String(name ?? ""), lat: lat === null || lat === "" ? undefined : Number(lat), lng: lng === null || lng === "" ? undefined : Number(lng) },
    "starting area", true,
  );
  if (pin.error) errors.start = pin.error;
  const prefs = parsePreferences(fd);
  if (!prefs.ok) Object.assign(errors, prefs.errors);
  if (Object.keys(errors).length || !prefs.ok || !pin.pin) return { ok: false, errors };
  return { ok: true, value: { ...prefs.value, start: pin.pin } };
}

// What the pool builder needs from a member. The budget goes in here and nowhere else.
export function toPoolMember(m: Member): PoolMember | null {
  if (!m.answers) return null;
  const a = m.answers;
  return { id: m.id, firstName: m.firstName, start: a.start, budget: a.budgetPerPerson, dealbreakers: a.dealbreakers, vibes: a.vibes, cuisines: a.cuisines, maxTravelMin: a.maxTravelMin };
}

export const answeredMembers = (members: Member[]) => members.filter((m) => m.answeredAt != null && m.answers);
