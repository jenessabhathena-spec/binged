// The "Try the demo" group: you (Asha) and two pretend friends, so one person can see the whole flow alone.
// Everything here is plain code that runs in the browser: no sign-in, no server, nothing saved. It uses the same
// deck-building and matching code as a real plan.

import type { Swipe } from "@/lib/matching";
import { sampleCandidates, type Place } from "@/lib/places/place";
import { buildPool, type Pool, type PoolEntry, type PoolMember } from "@/lib/pool";

export const DEMO_YOU = "asha";

// Starting points are the middle of each neighbourhood. They are only used to estimate trips, and are never shown.
export const DEMO_PEOPLE: PoolMember[] = [
  { id: "asha", firstName: "Asha", start: { lat: 12.9784, lng: 77.6408 }, budget: 1500, dealbreakers: [], vibes: ["Cafe"], cuisines: ["South Indian", "Cafe"], maxTravelMin: 40 },
  { id: "ravi", firstName: "Ravi", start: { lat: 12.9352, lng: 77.6245 }, budget: 800, dealbreakers: ["no_alcohol"], vibes: [], cuisines: ["Biryani", "North Indian"], maxTravelMin: 40 },
  { id: "meera", firstName: "Meera", start: { lat: 12.9116, lng: 77.6474 }, budget: null, dealbreakers: ["must_have_veg"], vibes: ["Quiet"], cuisines: ["Asian", "Italian"], maxTravelMin: 40 },
];

export const DEMO_PLAN = { searchMode: "anywhere_fair" as const, searchArea: null };

export const buildDemoPool = (): Pool => buildPool(DEMO_PEOPLE, DEMO_PLAN, sampleCandidates());

// What each pretend friend likes. Simple and visible, so the demo feels real: Ravi goes for hearty Indian food
// (and a sweet tooth, and Asian), Meera for pure veg and cafe / Asian / Italian places. They overlap on a couple of
// places, so saying yes to the right ones gives a full match, and the wrong ones give the final vote.
const LIKES: Record<string, (p: Place) => boolean> = {
  ravi: (p) => p.cuisines.some((c) => ["Biryani", "North Indian", "South Indian", "Continental", "Desserts", "Asian"].includes(c)),
  meera: (p) => p.veg === "veg-only" || p.cuisines.some((c) => ["Asian", "Italian", "Cafe", "Desserts"].includes(c)),
};

export function friendSwipes(deck: PoolEntry[]): Swipe[] {
  return Object.entries(LIKES).flatMap(([memberId, likes]) => deck.map((e) => ({ memberId, placeId: e.place.id, liked: likes(e.place) })));
}

// In a tied final vote the friends split, so the person using the demo casts the deciding vote.
export const friendTieVotes = (optionIds: [string, string]) => ({ ravi: optionIds[0], meera: optionIds[1] });
