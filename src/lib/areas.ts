// Bengaluru localities: the built-in area list for search (mock mode, and the fallback when Google is down),
// plus helpers shared by the browser and the server. Pure: no React, no Node APIs.
//
// Coordinates are each locality's approximate centre: good enough to name an area and estimate travel,
// which is all we store (SPEC §2.2: an area and a pin, never a street address).

import { config } from "@/config";

export type Point = { lat: number; lng: number };
export type Area = Point & { name: string };

export const LOCALITIES: Area[] = [
  { name: "Indiranagar", lat: 12.9784, lng: 77.6408 },
  { name: "Koramangala", lat: 12.9352, lng: 77.6245 },
  { name: "HSR Layout", lat: 12.9116, lng: 77.6474 },
  { name: "BTM Layout", lat: 12.9166, lng: 77.6101 },
  { name: "Jayanagar", lat: 12.925, lng: 77.5938 },
  { name: "JP Nagar", lat: 12.9063, lng: 77.5857 },
  { name: "Basavanagudi", lat: 12.9406, lng: 77.5738 },
  { name: "Banashankari", lat: 12.9255, lng: 77.5468 },
  { name: "Malleshwaram", lat: 13.0035, lng: 77.571 },
  { name: "Rajajinagar", lat: 12.991, lng: 77.552 },
  { name: "Yeshwanthpur", lat: 13.0285, lng: 77.5409 },
  { name: "Hebbal", lat: 13.0358, lng: 77.597 },
  { name: "RT Nagar", lat: 13.0211, lng: 77.5951 },
  { name: "Sadashivanagar", lat: 13.0068, lng: 77.5813 },
  { name: "Frazer Town", lat: 12.9988, lng: 77.615 },
  { name: "Ulsoor", lat: 12.9817, lng: 77.6286 },
  { name: "MG Road", lat: 12.9756, lng: 77.6066 },
  { name: "Shivajinagar", lat: 12.9857, lng: 77.6057 },
  { name: "Richmond Town", lat: 12.962, lng: 77.6 },
  { name: "Lavelle Road", lat: 12.9716, lng: 77.596 },
  { name: "Domlur", lat: 12.9609, lng: 77.6387 },
  { name: "CV Raman Nagar", lat: 12.9857, lng: 77.6633 },
  { name: "Marathahalli", lat: 12.9569, lng: 77.7011 },
  { name: "Brookefield", lat: 12.968, lng: 77.718 },
  { name: "Whitefield", lat: 12.9698, lng: 77.75 },
  { name: "Mahadevapura", lat: 12.991, lng: 77.695 },
  { name: "KR Puram", lat: 13.0076, lng: 77.695 },
  { name: "Bellandur", lat: 12.9304, lng: 77.6784 },
  { name: "Sarjapur Road", lat: 12.91, lng: 77.687 },
  { name: "Electronic City", lat: 12.8452, lng: 77.6602 },
  { name: "Bannerghatta Road", lat: 12.888, lng: 77.597 },
  { name: "Wilson Garden", lat: 12.9481, lng: 77.597 },
  { name: "Hennur", lat: 13.0358, lng: 77.6431 },
  { name: "Kalyan Nagar", lat: 13.0221, lng: 77.6403 },
  { name: "Kammanahalli", lat: 13.0152, lng: 77.638 },
  { name: "Banaswadi", lat: 13.0104, lng: 77.6482 },
  { name: "Yelahanka", lat: 13.1007, lng: 77.5963 },
  { name: "Vijayanagar", lat: 12.9719, lng: 77.5373 },
];

export function inCity(p: Partial<Point>): p is Point {
  const b = config.cityBounds;
  return typeof p.lat === "number" && typeof p.lng === "number" && Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
    p.lat >= b.minLat && p.lat <= b.maxLat && p.lng >= b.minLng && p.lng <= b.maxLng;
}

// ~110 m. A pin is a meeting-planning hint, not a doorstep; we keep no more precision than travel needs.
export const roundCoord = (x: number) => Math.round(x * 1000) / 1000;

// Distance in km (haversine).
export function km(a: Point, b: Point) {
  const R = 6371, rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// The locality name for a dropped pin.
export function nearestLocality(p: Point): Area {
  return LOCALITIES.reduce((best, a) => (km(p, a) < km(p, best) ? a : best), LOCALITIES[0]);
}

export function searchLocalities(q: string, limit = 6): Area[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const starts = LOCALITIES.filter((a) => a.name.toLowerCase().startsWith(s));
  const contains = LOCALITIES.filter((a) => !starts.includes(a) && a.name.toLowerCase().includes(s));
  return [...starts, ...contains].slice(0, limit);
}

// The built-in map's window onto the city, and lat/lng <-> map position (0..1) for it.
export const MAP_VIEW = { minLat: 12.82, maxLat: 13.12, minLng: 77.5, maxLng: 77.78 };
export function toMap(p: Point) {
  return { x: (p.lng - MAP_VIEW.minLng) / (MAP_VIEW.maxLng - MAP_VIEW.minLng), y: (MAP_VIEW.maxLat - p.lat) / (MAP_VIEW.maxLat - MAP_VIEW.minLat) };
}
export function fromMap(x: number, y: number): Point {
  const cx = Math.min(1, Math.max(0, x)), cy = Math.min(1, Math.max(0, y));
  return { lat: MAP_VIEW.maxLat - cy * (MAP_VIEW.maxLat - MAP_VIEW.minLat), lng: MAP_VIEW.minLng + cx * (MAP_VIEW.maxLng - MAP_VIEW.minLng) };
}
