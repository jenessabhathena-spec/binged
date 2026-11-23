import { describe, expect, it } from "vitest";
import { EMPTY_PREFERENCES, inr, normalisePreferences, parsePreferences, summarise } from "@/lib/preferences";

const form = (entries: [string, string][]) => {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
};

describe("parsePreferences: every question is skippable", () => {
  it("an empty form is valid and means 'nothing chosen', with the default travel time", () => {
    const r = parsePreferences(new FormData());
    expect(r).toEqual({ ok: true, value: EMPTY_PREFERENCES });
    expect(EMPTY_PREFERENCES.maxTravelMin).toBe(40);
    expect(EMPTY_PREFERENCES.budgetPerPerson).toBeNull();
  });

  it("'No preference' (an empty radio value) is the same as skipping", () => {
    const r = parsePreferences(form([["diet", ""], ["spice", ""]]));
    expect(r.ok && r.value.diet).toBeNull();
    expect(r.ok && r.value.spice).toBeNull();
  });

  it("reads a full answer", () => {
    const r = parsePreferences(form([
      ["cuisines", "North Indian"], ["cuisines", "Cafe"], ["diet", "Veg"], ["spice", "Medium"],
      ["budget", "1200"], ["vibes", "Quiet"], ["vibes", "Rooftop"],
      ["dealbreakers", "must_have_veg"], ["dealbreakers", "needs_parking"], ["maxTravelMin", "30"],
    ]));
    expect(r).toEqual({ ok: true, value: {
      cuisines: ["North Indian", "Cafe"], diet: "Veg", spice: "Medium", budgetPerPerson: 1200,
      vibes: ["Quiet", "Rooftop"], dealbreakers: ["must_have_veg", "needs_parking"], maxTravelMin: 30,
    } });
  });

  it("drops duplicate choices", () => {
    const r = parsePreferences(form([["cuisines", "Cafe"], ["cuisines", "Cafe"]]));
    expect(r.ok && r.value.cuisines).toEqual(["Cafe"]);
  });
});

describe("parsePreferences: the budget", () => {
  it("is skipped when 'I'd rather not say' is ticked, even if a slider value was sent", () => {
    const r = parsePreferences(form([["budget", "1500"], ["budgetSkip", "on"]]));
    expect(r.ok && r.value.budgetPerPerson).toBeNull();
  });

  it.each([["199"], ["4100"], ["1250"], ["abc"], ["1e3"], ["-500"], ["1000.5"], ["0x3E8"], [" 1000"], ["1000 "], ["1111111"]])("rejects %s (outside the range or step)", (b) => {
    const r = parsePreferences(form([["budget", b]]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.budgetPerPerson).toBeTruthy();
  });

  it("accepts the ends of the range", () => {
    expect(parsePreferences(form([["budget", "200"]])).ok).toBe(true);
    expect(parsePreferences(form([["budget", "4000"]])).ok).toBe(true);
  });
});

describe("parsePreferences: values outside the lists are rejected, never kept", () => {
  it("rejects an unknown cuisine, vibe, dealbreaker, diet, spice and travel time", () => {
    for (const [k, v] of [["cuisines", "Martian"], ["vibes", "Haunted"], ["dealbreakers", "hates_fun"], ["diet", "Carnivore"], ["spice", "Nuclear"], ["maxTravelMin", "45"]] as const) {
      const r = parsePreferences(form([[k, v]]));
      expect(r.ok, `${k}=${v}`).toBe(false);
    }
  });
});

describe("normalisePreferences: stored data is read defensively", () => {
  it("falls back to 'skipped' for junk, missing and wrong-typed values", () => {
    expect(normalisePreferences(undefined)).toEqual(EMPTY_PREFERENCES);
    expect(normalisePreferences(null)).toEqual(EMPTY_PREFERENCES);
    expect(normalisePreferences("nope")).toEqual(EMPTY_PREFERENCES);
    expect(normalisePreferences({ cuisines: "Cafe", diet: 5, budgetPerPerson: "900", maxTravelMin: 99, vibes: [1, 2] })).toEqual(EMPTY_PREFERENCES);
  });

  it("keeps good values and filters out bad ones in a list", () => {
    const p = normalisePreferences({ cuisines: ["Cafe", "Martian", "Cafe"], diet: "Jain", budgetPerPerson: 800, maxTravelMin: 20 });
    expect(p.cuisines).toEqual(["Cafe"]);
    expect(p.diet).toBe("Jain");
    expect(p.budgetPerPerson).toBe(800);
    expect(p.maxTravelMin).toBe(20);
  });

  it("round-trips what parsePreferences produced", () => {
    const r = parsePreferences(form([["cuisines", "Biryani"], ["diet", "Non-veg"], ["budget", "600"], ["dealbreakers", "no_alcohol"], ["maxTravelMin", "50"]]));
    expect(r.ok && normalisePreferences(r.value)).toEqual(r.ok && r.value);
  });
});

describe("privacy of the budget", () => {
  it("the home-page summary never contains the budget", () => {
    const s = summarise({ ...EMPTY_PREFERENCES, cuisines: ["Cafe"], diet: "Veg", vibes: ["Quiet"], budgetPerPerson: 1337 });
    expect(s).toBe("Cafe · Veg · Quiet");
    expect(s).not.toContain("1337");
    expect(s).not.toMatch(/₹/);
  });

  it("says so when nothing is set, and formats rupees the Indian way", () => {
    expect(summarise(EMPTY_PREFERENCES)).toBe("Nothing set yet");
    expect(inr(1200)).toBe("₹1,200");
    expect(inr(100000)).toBe("₹1,00,000");
  });
});
