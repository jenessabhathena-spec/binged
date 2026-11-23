// The candidate pool (SPEC §7.1): from everyone's answers, pick the places worth swiping on.
//   meeting point -> hard filters (budget, dealbreakers) -> travel limits -> score -> a diverse deck + a reserve.
// Pure: no React, no Node APIs, no network. Travel times are passed in, so tests use fixed numbers and the real
// Routes API can replace the estimate later. Nothing here ever returns a member's budget: only the shared
// ceiling is used, and only inside this function.

import { config } from "@/config";
import { km, nearestLocality, type Point } from "@/lib/areas";
import type { Place } from "@/lib/places/place";
import { primaryCuisine } from "@/lib/places/place";
import type { DealbreakerKey } from "@/lib/preferences";
import type { AreaPin } from "@/lib/profile";

export type PoolMember = {
  id: string;
  firstName: string;
  start: Point;
  budget: number | null; // PRIVATE
  dealbreakers: DealbreakerKey[];
  vibes: string[];
  cuisines: string[];
  maxTravelMin: number;
};

export type PoolPlan = { searchMode: "anywhere_fair" | "area"; searchArea: AreaPin | null };

export type PoolEntry = {
  place: Place; // a snapshot, so the deck never changes under people's fingers
  score: number; // 0..1
  travel: Record<string, number>; // memberId -> minutes (estimate)
  maxTravel: number;
  spread: number; // longest minus shortest trip
  reason: string; // one honest line about why it fits
  unconfirmed: string[]; // facts we don't have yet, e.g. "price"
};

export type Pool = {
  center: Point;
  centerName: string;
  radiusKm: number; // how far from the meeting point we had to look
  deck: PoolEntry[];
  reserve: PoolEntry[];
  considered: number;
  rejected: { budget: number; dealbreaker: number; travel: number };
  shortfall: boolean; // fewer places than a full deck fit everyone
};

export type TravelFn = (from: Point, to: Point) => number;

// Demo-mode estimate: straight-line distance, a detour allowance, city traffic speed, plus pickup time.
export const estimateTravelMinutes: TravelFn = (a, b) => {
  const { detourFactor, speedKmh, fixedMinutes } = config.travel;
  return Math.round(((km(a, b) * detourFactor) / speedKmh) * 60 + fixedMinutes);
};

// One meeting point for everybody: the organiser's chosen area, or else the middle of everyone's start points.
export function meetingPoint(members: Pick<PoolMember, "start">[], plan: PoolPlan): { center: Point; name: string } {
  if (plan.searchMode === "area" && plan.searchArea) return { center: plan.searchArea, name: plan.searchArea.name };
  const n = members.length || 1;
  const center = { lat: members.reduce((s, m) => s + m.start.lat, 0) / n, lng: members.reduce((s, m) => s + m.start.lng, 0) / n };
  return { center, name: nearestLocality(center).name };
}

// The most any one person can pay per head and still be inside everyone's budget. Never shown to anyone.
export const sharedCeiling = (members: Pick<PoolMember, "budget">[]): number | null => {
  const b = members.map((m) => m.budget).filter((x): x is number => x != null);
  return b.length ? Math.min(...b) : null;
};

export type Rejection = "budget" | "dealbreaker" | null;

// Hard filters. A fact we don't have (price, alcohol) can't break a rule, so unknowns pass and are flagged on the card.
export function rejection(place: Place, members: Pick<PoolMember, "dealbreakers">[], ceiling: number | null): Rejection {
  if (ceiling != null && place.priceRange && place.priceRange.min > ceiling) return "budget";
  const wants = new Set(members.flatMap((m) => m.dealbreakers));
  if (wants.has("no_alcohol") && place.servesAlcohol === true) return "dealbreaker";
  return null;
}

// What we can't confirm for this place and the group's rules, shown on the card instead of pretending.
export function unconfirmedFor(place: Place, members: Pick<PoolMember, "dealbreakers" | "budget">[]): string[] {
  const out: string[] = [];
  if (!place.priceRange && members.some((m) => m.budget != null)) out.push("price");
  const wants = new Set(members.flatMap((m) => m.dealbreakers));
  if (wants.has("must_have_veg") && place.veg === "unknown") out.push("veg options");
  if (wants.has("no_alcohol") && place.servesAlcohol === null) out.push("alcohol");
  if (wants.has("needs_parking")) out.push("parking");
  if (wants.has("wheelchair_access")) out.push("wheelchair access");
  return out;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export type Factors = { taste: number; fairness: number; vibe: number; quality: number; novelty: number };

export function factorsFor(place: Place, members: PoolMember[], travel: Record<string, number>): Factors {
  const times = Object.values(travel);
  const maxT = Math.max(...times), minT = Math.min(...times);
  const limit = Math.min(...members.map((m) => m.maxTravelMin));
  // Fairness: a short longest trip matters most, a small gap between the shortest and longest trip matters too.
  const fairness = 0.7 * clamp01(1 - maxT / limit) + 0.3 * clamp01(1 - (maxT - minT) / limit);
  const withTastes = members.filter((m) => m.cuisines.length);
  const taste = withTastes.length ? withTastes.filter((m) => m.cuisines.some((c) => place.cuisines.includes(c))).length / withTastes.length : 0.5;
  const vibe = members.length ? members.reduce((s, m) => s + (m.vibes.length ? (m.vibes.some((v) => place.vibes.includes(v)) ? 1 : 0) : 0.5), 0) / members.length : 0.5;
  // Quality: rating pulled toward neutral when few people rated it. Unknown rating is neutral, not a penalty.
  let quality = 0.5;
  if (place.rating != null) {
    const n = place.ratingCount ?? 0;
    const w = n / (n + 50);
    quality = clamp01(((place.rating - 3) / 2) * w + 0.5 * (1 - w));
  }
  return { taste, fairness, vibe, quality, novelty: 1 };
}

export function weightedScore(f: Factors): number {
  const w = config.weights;
  const total = w.taste + w.fairness + w.vibe + w.quality + w.novelty;
  return (f.taste * w.taste + f.fairness * w.fairness + f.vibe * w.vibe + f.quality * w.quality + f.novelty * w.novelty) / total;
}

// One line of true statements: only things we actually know about this place and these people.
export function reasonFor(place: Place, members: PoolMember[], maxTravel: number, ceiling: number | null): string {
  const parts: string[] = [];
  const likers = members.filter((m) => m.cuisines.some((c) => place.cuisines.includes(c))).length;
  if (likers > 0 && members.some((m) => m.cuisines.length)) parts.push(likers === members.length ? "Everyone likes this cuisine" : `${likers} of ${members.length} like this cuisine`);
  parts.push(`Longest trip ${maxTravel} min`);
  const vibers = members.filter((m) => m.vibes.some((v) => place.vibes.includes(v))).length;
  if (vibers > 0) parts.push(`${vibers} of ${members.length} want this vibe`);
  if (place.veg === "veg-only") parts.push("Pure veg");
  if (ceiling != null && place.priceRange) parts.push("Fits everyone's budget");
  return parts.slice(0, 3).join(" · ");
}

// Builds the deck (everyone swipes these) and the reserve (replacements) from the places we know about.
export function buildPool(members: PoolMember[], plan: PoolPlan, places: Place[], travel: TravelFn = estimateTravelMinutes): Pool {
  const { center, name: centerName } = meetingPoint(members, plan);
  const ceiling = sharedCeiling(members);
  const rejected = { budget: 0, dealbreaker: 0, travel: 0 };

  const evaluate = (radiusKm: number): PoolEntry[] => {
    const out: PoolEntry[] = [];
    for (const place of places) {
      if (km(center, place.location) > radiusKm) continue;
      const rule = rejection(place, members, ceiling);
      if (rule) continue;
      const times: Record<string, number> = {};
      for (const m of members) times[m.id] = travel(m.start, place.location);
      // Drop a place if ANY member's trip is longer than that member's limit.
      if (members.some((m) => times[m.id] > m.maxTravelMin)) continue;
      const vals = Object.values(times);
      const maxTravel = Math.max(...vals), spread = maxTravel - Math.min(...vals);
      const f = factorsFor(place, members, times);
      out.push({ place, score: weightedScore(f), travel: times, maxTravel, spread, reason: reasonFor(place, members, maxTravel, ceiling), unconfirmed: unconfirmedFor(place, members) });
    }
    // Best first; ties broken by name so the same answers always give the same deck.
    return out.sort((a, b) => b.score - a.score || a.place.name.localeCompare(b.place.name));
  };

  let radiusKm: number = config.search.radiusStepsKm[0];
  let ranked: PoolEntry[] = [];
  for (const r of config.search.radiusStepsKm) {
    radiusKm = r;
    ranked = evaluate(r);
    if (ranked.length >= config.deck.size) break;
  }

  // Count why places were left out (for the organiser's "why so few" message), over the widest area looked at.
  for (const place of places) {
    if (km(center, place.location) > radiusKm) continue;
    const rule = rejection(place, members, ceiling);
    if (rule) { rejected[rule]++; continue; }
    if (members.some((m) => travel(m.start, place.location) > m.maxTravelMin)) rejected.travel++;
  }

  // Diversity: no more than maxSameCuisine of one cuisine in the deck, unless there is nothing else left.
  const deck: PoolEntry[] = [];
  const counts = new Map<string, number>();
  const rest: PoolEntry[] = [];
  for (const e of ranked) {
    const c = primaryCuisine(e.place);
    if (deck.length < config.deck.size && (counts.get(c) ?? 0) < config.deck.maxSameCuisine) { deck.push(e); counts.set(c, (counts.get(c) ?? 0) + 1); }
    else rest.push(e);
  }
  while (deck.length < config.deck.size && rest.length) deck.push(rest.shift()!);
  const reserve = rest.slice(0, config.deck.reserveSize);

  return { center, centerName, radiusKm, deck, reserve, considered: places.length, rejected, shortfall: deck.length < config.deck.size };
}
