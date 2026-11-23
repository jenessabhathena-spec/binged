// The one shape of a restaurant the rest of the app works with, whether it came from the built-in sample list
// (demo mode) or from Google Places (once GOOGLE_MAPS_SERVER_KEY exists). Pure: no React, no Node APIs.
//
// Anything Google would supply but the sample list doesn't know is null, never guessed. The screens say
// "not confirmed yet" for those rather than showing an invented number.

import type { Point } from "@/lib/areas";
import { SEED_PLACES, type SeedPlace } from "@/lib/places/seed";

export type Place = {
  id: string; // sample list: seedId. Google: place_id.
  name: string;
  area: string;
  location: Point;
  approxLocation: boolean; // true = the centre of the neighbourhood, not the restaurant's door
  address: string | null; // a street address for the restaurant itself (a business, not a person)
  cuisines: string[];
  vibes: string[];
  veg: "veg-only" | "veg-friendly" | "unknown";
  servesAlcohol: boolean | null; // null = unknown
  priceRange: { min: number; max: number } | null; // ₹ per person
  rating: number | null;
  ratingCount: number | null;
  phone: string | null;
  website: string | null;
  googleMapsUri: string | null;
  photo: { url: string; kind: "dish" | "place"; credit: string } | null;
  source: "sample" | "google";
};

// Openly licensed dish photos (Wikimedia Commons) stand in for restaurant photos in demo mode. They show the
// KIND of food, not the restaurant, and the card says so. Credits live at /credits.
const PHOTO_BY_CUISINE: Record<string, { file: string; label: string }> = {
  "South Indian": { file: "south-indian", label: "South Indian" },
  Biryani: { file: "biryani", label: "Biryani" },
  Italian: { file: "italian", label: "Italian" },
  Asian: { file: "asian", label: "Asian" },
  Cafe: { file: "cafe", label: "Cafe" },
  Desserts: { file: "desserts", label: "Desserts" },
  "North Indian": { file: "north-indian", label: "North Indian" },
  "Street Food": { file: "street-food", label: "Street food" },
  Continental: { file: "continental", label: "Continental" },
  Pub: { file: "pub", label: "Pub" },
};

export function dishPhoto(cuisines: string[]): Place["photo"] {
  for (const c of cuisines) {
    const hit = PHOTO_BY_CUISINE[c];
    if (hit) return { url: `/images/food/${hit.file}.jpg`, kind: "dish", credit: `${hit.label} dish (representative photo)` };
  }
  return null;
}

export function fromSeed(s: SeedPlace): Place {
  return {
    id: s.seedId, name: s.name, area: s.area, location: s.location, approxLocation: s.approxLocation,
    address: null, cuisines: s.cuisines, vibes: s.vibes, veg: s.veg,
    servesAlcohol: s.vibes.includes("Pub") ? true : null, // pubs and breweries serve alcohol; for the rest we don't know
    priceRange: s.priceRange, rating: s.rating, ratingCount: null, phone: s.phone, website: null, googleMapsUri: null,
    photo: dishPhoto(s.cuisines), source: "sample",
  };
}

// Where candidate places come from. Demo mode: the sample list. Real mode: Google Places Nearby Search around
// the meeting point (not wired yet: it needs the key, so it is added with the Maps milestone).
export function sampleCandidates(): Place[] {
  return SEED_PLACES.map(fromSeed);
}

export const primaryCuisine = (p: Place) => p.cuisines[0] ?? "Other";
