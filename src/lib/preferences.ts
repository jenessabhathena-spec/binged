// Preferences (SPEC S3): cuisines, diet, spice, usual budget, vibe, dealbreakers, max travel time.
// Every question is skippable: "skipped" is null for single choices and [] for multi-choices. Shared by the
// form (to render) and the server action (the real validation). Pure: no React, no Node APIs.

import { config } from "@/config";

export const CUISINES = ["North Indian", "South Indian", "Chinese", "Asian", "Italian", "Continental", "Cafe", "Biryani", "Desserts", "Street Food", "Seafood"] as const;
export const DIETS = ["Veg", "Non-veg", "Jain", "Vegan", "Eggetarian"] as const;
export const SPICES = ["Mild", "Medium", "Hot"] as const;
export const VIBES = ["Quiet", "Lively", "Rooftop", "Cafe", "Pub", "Family"] as const;
export const DEALBREAKERS = [
  { key: "must_have_veg", label: "Must have veg options" },
  { key: "no_alcohol", label: "No alcohol served" },
  { key: "needs_parking", label: "Needs parking" },
  { key: "wheelchair_access", label: "Wheelchair access" },
] as const;
export const TRAVEL_MINUTES = [15, 20, 30, 40, 50, 60] as const;

export type Diet = (typeof DIETS)[number];
export type Spice = (typeof SPICES)[number];
export type DealbreakerKey = (typeof DEALBREAKERS)[number]["key"];

export type Preferences = {
  cuisines: string[];
  diet: Diet | null;
  spice: Spice | null;
  budgetPerPerson: number | null; // PRIVATE (₹): only this person and the server ever see it
  vibes: string[];
  dealbreakers: DealbreakerKey[];
  maxTravelMin: number;
};

export const EMPTY_PREFERENCES: Preferences = {
  cuisines: [], diet: null, spice: null, budgetPerPerson: null, vibes: [], dealbreakers: [],
  maxTravelMin: config.travel.defaultMaxMinutes,
};

export type PreferencesErrors = Partial<Record<keyof Preferences, string>>;

const oneOf = <T extends string>(v: FormDataEntryValue | null, allowed: readonly T[]): T | null | undefined => {
  if (v === null || v === "") return null; // skipped
  return allowed.includes(v as T) ? (v as T) : undefined; // undefined = not an allowed value
};

const manyOf = (values: FormDataEntryValue[], allowed: readonly string[]): string[] | undefined => {
  const picked = [...new Set(values.map(String))];
  return picked.every((v) => allowed.includes(v)) ? picked : undefined;
};

// Reads the form and validates it. Anything outside the allowed lists is rejected, never silently kept.
export function parsePreferences(fd: FormData): { ok: true; value: Preferences } | { ok: false; errors: PreferencesErrors } {
  const errors: PreferencesErrors = {};

  const cuisines = manyOf(fd.getAll("cuisines"), CUISINES);
  if (!cuisines) errors.cuisines = "Pick cuisines from the list";
  const vibes = manyOf(fd.getAll("vibes"), VIBES);
  if (!vibes) errors.vibes = "Pick vibes from the list";
  const dealbreakers = manyOf(fd.getAll("dealbreakers"), DEALBREAKERS.map((d) => d.key));
  if (!dealbreakers) errors.dealbreakers = "Pick dealbreakers from the list";

  const diet = oneOf(fd.get("diet"), DIETS);
  if (diet === undefined) errors.diet = "Pick a diet from the list";
  const spice = oneOf(fd.get("spice"), SPICES);
  if (spice === undefined) errors.spice = "Pick a spice level from the list";

  // Budget: skipped unless the person chose one. Whole rupees within the slider's range and step.
  let budget: number | null = null;
  const rawBudget = fd.get("budget");
  if (fd.get("budgetSkip") === null && rawBudget !== null && rawBudget !== "") {
    // Plain digits only: Number() would also accept "1e3", "0x3E8" and padded strings.
    const n = /^\d{1,6}$/.test(String(rawBudget)) ? Number(rawBudget) : Number.NaN;
    const { min, max, step } = config.budget;
    if (!Number.isInteger(n) || n < min || n > max || (n - min) % step !== 0) errors.budgetPerPerson = `Choose a budget between ₹${min} and ₹${max}`;
    else budget = n;
  }

  let maxTravelMin: number = config.travel.defaultMaxMinutes;
  const rawTravel = fd.get("maxTravelMin");
  if (rawTravel !== null && rawTravel !== "") {
    const n = /^\d{1,3}$/.test(String(rawTravel)) ? Number(rawTravel) : Number.NaN;
    if (!(TRAVEL_MINUTES as readonly number[]).includes(n)) errors.maxTravelMin = "Choose a travel time from the list";
    else maxTravelMin = n;
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { cuisines: cuisines!, diet: diet as Diet | null, spice: spice as Spice | null, budgetPerPerson: budget, vibes: vibes!, dealbreakers: dealbreakers as DealbreakerKey[], maxTravelMin } };
}

// Defensive read of stored data (a cookie or a database row): bad or missing values fall back to "skipped".
export function normalisePreferences(raw: unknown): Preferences {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = (v: unknown, allowed: readonly string[]) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && allowed.includes(x)))] : []);
  const one = <T extends string>(v: unknown, allowed: readonly T[]) => (typeof v === "string" && allowed.includes(v as T) ? (v as T) : null);
  const b = r.budgetPerPerson, t = r.maxTravelMin;
  return {
    cuisines: list(r.cuisines, CUISINES),
    diet: one(r.diet, DIETS),
    spice: one(r.spice, SPICES),
    budgetPerPerson: typeof b === "number" && Number.isInteger(b) && b >= config.budget.min && b <= config.budget.max ? b : null,
    vibes: list(r.vibes, VIBES),
    dealbreakers: list(r.dealbreakers, DEALBREAKERS.map((d) => d.key)) as DealbreakerKey[],
    maxTravelMin: typeof t === "number" && (TRAVEL_MINUTES as readonly number[]).includes(t) ? t : config.travel.defaultMaxMinutes,
  };
}

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// A one-line summary for the home page. Never includes the budget: that is only shown to its owner on the form.
export function summarise(p: Preferences): string {
  const bits = [p.cuisines.slice(0, 3).join(", "), p.diet, p.vibes.slice(0, 2).join(", ")].filter(Boolean);
  return bits.length ? bits.join(" · ") : "Nothing set yet";
}
