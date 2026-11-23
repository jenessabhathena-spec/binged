import { describe, expect, it } from "vitest";
import { directionsUrl, mapsPlaceUrl, PartnerBookingProvider, telHref, winnerActions, winnerShareMessage } from "@/lib/booking";
import type { Place } from "@/lib/places/place";

const base: Place = {
  id: "toit", name: "Toit", area: "Indiranagar", location: { lat: 12.9784, lng: 77.6408 }, approxLocation: true, address: null,
  cuisines: ["Pub"], vibes: [], veg: "unknown", servesAlcohol: true, priceRange: null, rating: null, ratingCount: null,
  phone: null, website: null, googleMapsUri: null, photo: null, source: "sample",
};
const OPTS = { partySize: 4, startsAt: Date.parse("2026-11-27T20:00:00+05:30") };

describe("winner actions", () => {
  it("book online opens Google Maps: Google's own link when we have it", () => {
    const p = { ...base, googleMapsUri: "https://maps.google.com/?cid=123" };
    expect(winnerActions(p, OPTS).book.action).toEqual({ type: "url", value: "https://maps.google.com/?cid=123" });
  });
  it("without Google's link it searches Google Maps for the name and area, encoded safely", () => {
    const url = new URL(winnerActions({ ...base, name: "Brahmin's Coffee & Bar" }, OPTS).book.action.value);
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/search/");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("query")).toBe("Brahmin's Coffee & Bar, Indiranagar, Bengaluru");
  });
  it("uses the place_id for real Google places", () => {
    const url = new URL(mapsPlaceUrl({ ...base, id: "ChIJabc", source: "google" }));
    expect(url.searchParams.get("query_place_id")).toBe("ChIJabc");
  });
  it("directions go to the restaurant, by road", () => {
    const url = new URL(directionsUrl(base));
    expect(url.pathname).toBe("/maps/dir/");
    expect(url.searchParams.get("destination")).toBe("Toit, Indiranagar, Bengaluru");
    expect(url.searchParams.get("travelmode")).toBe("driving");
  });
  it("directions prefer the street address when we have one", () => {
    expect(new URL(directionsUrl({ ...base, address: "100 Feet Road" })).searchParams.get("destination")).toBe("Toit, 100 Feet Road, Bengaluru");
  });
  it("offers Call only when there is a phone number, as a tel: link with nothing but digits and +", () => {
    expect(winnerActions(base, OPTS).call).toBeNull();
    const call = winnerActions({ ...base, phone: "+91 80 1234 5678" }, OPTS).call;
    expect(call?.action).toEqual({ type: "tel", value: "tel:+918012345678" });
    expect(telHref("(080) 1234-5678; rm -rf")).toBe("tel:08012345678");
  });
  it("offers the website only for http(s) links", () => {
    expect(winnerActions({ ...base, website: "javascript:alert(1)" }, OPTS).website).toBeNull();
    expect(winnerActions({ ...base, website: "https://toit.in" }, OPTS).website?.action.value).toBe("https://toit.in");
  });
  it("the partner provider is a stub that handles nothing", () => {
    expect(PartnerBookingProvider.canHandle(base)).toBe(false);
  });
});

describe("share message", () => {
  it("names the place, the time and the map link", () => {
    const m = winnerShareMessage(base, OPTS.startsAt);
    expect(m).toContain("Toit (Indiranagar)");
    expect(m).toContain("Fri 27 Nov, 8:00 pm");
    expect(m).toContain("https://www.google.com/maps/search/");
  });
});
