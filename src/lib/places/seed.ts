// Mock-mode restaurant list (used until GOOGLE_MAPS_SERVER_KEY is set).
//
// Real, well-known Bengaluru restaurants, but ONLY the facts we are confident of: name, neighbourhood and the
// kind of food. Locations are the neighbourhood's centre (approxLocation: true), not the restaurant's exact
// spot. Price, rating, opening hours, phone and photos are deliberately null: the UI marks them "sample" and
// real values come from Google Places once the key is added. A place may have moved or closed since this list
// was written; Google is the source of truth.

export type SeedPlace = {
  seedId: string;
  name: string;
  area: string;
  location: { lat: number; lng: number };
  approxLocation: true;
  cuisines: string[]; // our cuisine chips (see preferences)
  vibes: string[]; // our vibe chips
  veg: "veg-only" | "veg-friendly" | "unknown";
  // Unknown until Google: never invent these.
  priceRange: null;
  rating: null;
  openingHours: null;
  phone: null;
  photoUrl: null;
};

const AREA = {
  Indiranagar: { lat: 12.9784, lng: 77.6408 },
  Koramangala: { lat: 12.9352, lng: 77.6245 },
  "HSR Layout": { lat: 12.9116, lng: 77.6474 },
  Jayanagar: { lat: 12.925, lng: 77.5938 },
  Basavanagudi: { lat: 12.9406, lng: 77.5738 },
  Malleshwaram: { lat: 13.0035, lng: 77.571 },
  "MG Road": { lat: 12.9719, lng: 77.6012 },
  "Residency Road": { lat: 12.9667, lng: 77.607 },
  "Lalbagh Road": { lat: 12.9545, lng: 77.5859 },
  "UB City": { lat: 12.9716, lng: 77.596 },
  Hennur: { lat: 13.0358, lng: 77.6431 },
  Whitefield: { lat: 12.9698, lng: 77.75 },
} as const;

type Area = keyof typeof AREA;
const p = (seedId: string, name: string, area: Area, cuisines: string[], vibes: string[], veg: SeedPlace["veg"] = "unknown"): SeedPlace => ({
  seedId, name, area, location: AREA[area], approxLocation: true, cuisines, vibes, veg,
  priceRange: null, rating: null, openingHours: null, phone: null, photoUrl: null,
});

export const SEED_PLACES: SeedPlace[] = [
  p("toit", "Toit", "Indiranagar", ["Pub", "Italian"], ["Lively", "Pub"]),
  p("fatty-bao", "The Fatty Bao", "Indiranagar", ["Asian"], ["Lively"]),
  p("burma-burma", "Burma Burma", "Indiranagar", ["Asian"], ["Quiet", "Family"], "veg-only"),
  p("glens", "Glen's Bakehouse", "Indiranagar", ["Cafe", "Desserts"], ["Cafe", "Quiet"]),
  p("smoke-house-deli", "Smoke House Deli", "Indiranagar", ["Continental", "Cafe"], ["Cafe", "Family"]),
  p("rameshwaram-indiranagar", "The Rameshwaram Cafe", "Indiranagar", ["South Indian"], ["Family"], "veg-only"),
  p("lavonne", "Lavonne", "Indiranagar", ["Cafe", "Desserts"], ["Cafe", "Quiet"]),
  p("meghana-koramangala", "Meghana Foods", "Koramangala", ["Biryani", "South Indian"], ["Family"]),
  p("truffles-koramangala", "Truffles", "Koramangala", ["Continental", "Cafe"], ["Lively", "Family"]),
  p("empire-koramangala", "Empire Restaurant", "Koramangala", ["North Indian", "Biryani"], ["Family"]),
  p("hole-in-the-wall", "Hole in the Wall Cafe", "Koramangala", ["Cafe", "Continental"], ["Cafe"]),
  p("chianti", "Chianti", "Koramangala", ["Italian"], ["Quiet"]),
  p("black-pearl", "The Black Pearl", "Koramangala", ["North Indian", "Continental"], ["Lively", "Pub"]),
  p("koramangala-social", "Koramangala Social", "Koramangala", ["Continental", "North Indian"], ["Lively", "Pub"]),
  p("dyu-art-cafe", "Dyu Art Cafe", "Koramangala", ["Cafe"], ["Cafe", "Quiet"]),
  p("third-wave-koramangala", "Third Wave Coffee", "Koramangala", ["Cafe"], ["Cafe", "Quiet"]),
  p("taaza-thindi", "Taaza Thindi", "Jayanagar", ["South Indian"], ["Family"], "veg-only"),
  p("corner-house-jayanagar", "Corner House Ice Creams", "Jayanagar", ["Desserts"], ["Family"], "veg-only"),
  p("vidyarthi-bhavan", "Vidyarthi Bhavan", "Basavanagudi", ["South Indian"], ["Family"], "veg-only"),
  p("brahmins-coffee-bar", "Brahmin's Coffee Bar", "Basavanagudi", ["South Indian", "Cafe"], ["Cafe"], "veg-only"),
  p("ctr", "CTR (Shri Sagar)", "Malleshwaram", ["South Indian"], ["Family"], "veg-only"),
  p("veena-stores", "Veena Stores", "Malleshwaram", ["South Indian"], ["Family"], "veg-only"),
  p("mtr", "MTR (Mavalli Tiffin Room)", "Lalbagh Road", ["South Indian"], ["Family"], "veg-only"),
  p("koshys", "Koshy's", "MG Road", ["Continental", "North Indian"], ["Quiet", "Family"]),
  p("nagarjuna", "Nagarjuna", "Residency Road", ["South Indian", "Biryani"], ["Family"]),
  p("karavalli", "Karavalli", "Residency Road", ["South Indian"], ["Quiet"]),
  p("shiro", "Shiro", "UB City", ["Asian"], ["Lively", "Rooftop"]),
  p("toscano-ub", "Toscano", "UB City", ["Italian"], ["Quiet"]),
  p("byg-brewski-hennur", "Byg Brewski Brewing Company", "Hennur", ["Pub", "Continental"], ["Lively", "Pub", "Family"]),
  p("windmills", "Windmills Craftworks", "Whitefield", ["Pub", "Continental"], ["Lively", "Pub"]),
];
