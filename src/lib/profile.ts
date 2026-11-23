// Profile shape and validation, shared by the form (instant feedback) and the server action (the real check).

import { inCity, roundCoord, type Point } from "@/lib/areas";

export type AreaPin = { name: string; lat: number; lng: number };

export type Profile = {
  name: string;
  email: string; // from Google, read-only
  avatarUrl: string | null;
  home: AreaPin | null;
  work: AreaPin | null;
};

export type ProfileInput = { name: string; home: Partial<AreaPin> | null; work: Partial<AreaPin> | null };
export type ProfileErrors = Partial<Record<"name" | "home" | "work", string>>;

export function cleanPin(p: Partial<AreaPin> | null, label: string, required: boolean): { pin: AreaPin | null; error?: string } {
  const empty = !p || (p.lat == null && p.lng == null && !p.name);
  if (empty) return required ? { pin: null, error: `Choose your ${label} on the map or search for it` } : { pin: null };
  const name = String(p!.name ?? "").trim().replace(/\s+/g, " ");
  if (!name || name.length > 80) return { pin: null, error: `Give your ${label} a name (up to 80 characters)` };
  if (!inCity(p as Partial<Point>)) return { pin: null, error: `Your ${label} must be in Bengaluru` };
  return { pin: { name, lat: roundCoord(p!.lat as number), lng: roundCoord(p!.lng as number) } };
}

export function validateProfile(input: ProfileInput): { ok: true; value: { name: string; home: AreaPin; work: AreaPin | null } } | { ok: false; errors: ProfileErrors } {
  const errors: ProfileErrors = {};
  const name = String(input.name ?? "").trim().replace(/\s+/g, " ");
  if (!name) errors.name = "Enter your name";
  else if (name.length > 60) errors.name = "Keep your name under 60 characters";
  const home = cleanPin(input.home, "home area", true);
  if (home.error) errors.home = home.error;
  const work = cleanPin(input.work, "work area", false);
  if (work.error) errors.work = work.error;
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name, home: home.pin!, work: work.pin } };
}

// Reads the form fields the AreaPicker writes (hidden inputs) into a ProfileInput.
export function profileInputFromForm(fd: FormData): ProfileInput {
  const pin = (prefix: string): Partial<AreaPin> | null => {
    const name = fd.get(`${prefix}Name`), lat = fd.get(`${prefix}Lat`), lng = fd.get(`${prefix}Lng`);
    if (!name && !lat && !lng) return null;
    return { name: String(name ?? ""), lat: lat === null || lat === "" ? undefined : Number(lat), lng: lng === null || lng === "" ? undefined : Number(lng) };
  };
  return { name: String(fd.get("name") ?? ""), home: pin("home"), work: pin("work") };
}

export const isProfileComplete = (p: Profile | null) => Boolean(p && p.name && p.home);
