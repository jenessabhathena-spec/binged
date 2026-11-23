// Winner actions (SPEC §8, S13): book, call, directions, share. Pure: it only builds links.
//
// v1 providers, in order of preference: the place's Google Maps page (shows a reserve button where the
// restaurant supports it), its website, its phone number. We never scrape or call undocumented endpoints of any
// booking platform. A real booking partner would implement BookingProvider and be added to PROVIDERS.

import { formatWhen } from "@/lib/plans";
import type { Place } from "@/lib/places/place";

export type BookingAction = { type: "url" | "tel"; value: string };

export interface BookingProvider {
  id: "google_maps" | "website" | "phone" | "partner";
  label: string;
  canHandle(place: Place): boolean;
  getAction(place: Place, opts: { partySize: number; startsAt: number }): BookingAction;
}

// Google's documented Maps URLs: https://developers.google.com/maps/documentation/urls/get-started
const MAPS = "https://www.google.com/maps";

const searchText = (p: Place) => [p.name, p.address ?? p.area, "Bengaluru"].filter(Boolean).join(", ");

// A link to the place on Google Maps: exact when we have Google's own link, otherwise a search for it by name.
export function mapsPlaceUrl(p: Place): string {
  if (p.googleMapsUri) return p.googleMapsUri;
  const q = new URLSearchParams({ api: "1", query: searchText(p) });
  if (p.source === "google") q.set("query_place_id", p.id);
  return `${MAPS}/search/?${q}`;
}

export function directionsUrl(p: Place): string {
  const q = new URLSearchParams({ api: "1", destination: searchText(p), travelmode: "driving" });
  if (p.source === "google") q.set("destination_place_id", p.id);
  return `${MAPS}/dir/?${q}`;
}

// Digits and a leading + only, so the tel: link can't carry anything else.
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

export const GoogleMapsProvider: BookingProvider = {
  id: "google_maps", label: "Book online",
  canHandle: () => true, // every place can at least be found on Google Maps
  getAction: (p) => ({ type: "url", value: mapsPlaceUrl(p) }),
};

export const WebsiteProvider: BookingProvider = {
  id: "website", label: "Restaurant website",
  canHandle: (p) => Boolean(p.website && /^https?:\/\//i.test(p.website)),
  getAction: (p) => ({ type: "url", value: p.website! }),
};

export const PhoneProvider: BookingProvider = {
  id: "phone", label: "Call to reserve",
  canHandle: (p) => Boolean(p.phone && p.phone.replace(/\D/g, "").length >= 6),
  getAction: (p) => ({ type: "tel", value: telHref(p.phone!) }),
};

// A booking partner would go here (keys from env vars). Left as a clearly marked stub: no partner agreed yet.
export const PartnerBookingProvider: BookingProvider = {
  id: "partner", label: "Book a table",
  canHandle: () => false,
  getAction: () => { throw new Error("No booking partner is connected yet"); },
};

const PROVIDERS: BookingProvider[] = [GoogleMapsProvider, WebsiteProvider, PhoneProvider];

export type WinnerActions = {
  book: { label: string; action: BookingAction };
  website: { label: string; action: BookingAction } | null;
  call: { label: string; action: BookingAction } | null; // null when we don't have a phone number yet
  directions: BookingAction;
  mapsUrl: string;
};

export function winnerActions(place: Place, opts: { partySize: number; startsAt: number }): WinnerActions {
  const web = WebsiteProvider.canHandle(place) ? WebsiteProvider : null;
  const phone = PhoneProvider.canHandle(place) ? PhoneProvider : null;
  return {
    book: { label: GoogleMapsProvider.label, action: GoogleMapsProvider.getAction(place, opts) },
    website: web ? { label: web.label, action: web.getAction(place, opts) } : null,
    call: phone ? { label: phone.label, action: phone.getAction(place, opts) } : null,
    directions: { type: "url", value: directionsUrl(place) },
    mapsUrl: mapsPlaceUrl(place),
  };
}

export const providerIds = () => PROVIDERS.map((p) => p.id);

// "We're going to Toit on Fri 27 Nov, 8:00 pm 🎉 <map link>"
export function winnerShareMessage(place: Place, startsAt: number): string {
  return `We're going to ${place.name} (${place.area}) on ${formatWhen(startsAt)} 🎉 ${mapsPlaceUrl(place)}`;
}

