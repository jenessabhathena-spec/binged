// What a restaurant card shows. Built on the server from a pool entry, then sent to the browser: so it carries
// first names and trip times only, never anyone's budget or start area. Pure: no React, no Node APIs.

import type { Member } from "@/lib/members";
import type { PoolEntry } from "@/lib/pool";
import { inr } from "@/lib/preferences";

export type CardData = {
  id: string;
  name: string;
  area: string;
  cuisines: string[];
  photo: { url: string; credit: string } | null;
  price: string | null; // "₹400–900 per person", or null when we don't know
  rating: string | null; // "4.3 ★ (1,204)"
  travel: { name: string; minutes: number }[]; // each member's trip, by first name
  maxTravel: number;
  reason: string;
  unconfirmed: string[]; // things we can't confirm yet ("price", "veg options")
  veg: "veg-only" | "veg-friendly" | "unknown";
  sample: boolean; // true = from the built-in sample list, not Google
};

export function priceLabel(p: { min: number; max: number } | null): string | null {
  if (!p) return null;
  return p.min === p.max ? `${inr(p.min)} per person` : `${inr(p.min)}–${inr(p.max)} per person`;
}

export function ratingLabel(rating: number | null, count: number | null): string | null {
  if (rating == null) return null;
  return count ? `${rating.toFixed(1)} ★ (${count.toLocaleString("en-IN")})` : `${rating.toFixed(1)} ★`;
}

export function toCard(e: PoolEntry, members: Pick<Member, "id" | "firstName">[]): CardData {
  const p = e.place;
  return {
    id: p.id, name: p.name, area: p.area, cuisines: p.cuisines,
    photo: p.photo ? { url: p.photo.url, credit: p.photo.credit } : null,
    price: priceLabel(p.priceRange), rating: ratingLabel(p.rating, p.ratingCount),
    travel: members.filter((m) => e.travel[m.id] != null).map((m) => ({ name: m.firstName, minutes: e.travel[m.id] })),
    maxTravel: e.maxTravel, reason: e.reason, unconfirmed: e.unconfirmed, veg: p.veg, sample: p.source === "sample",
  };
}
