import { describe, expect, it } from "vitest";
import { answeredMembers, lobbyView, parseAnswers, toPoolMember, validateFirstName, type Member } from "@/lib/members";

const form = (entries: Record<string, string | string[]>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x);
  return fd;
};
const START = { startName: "Indiranagar", startLat: "12.978", startLng: "77.641" };

describe("first name (guest join)", () => {
  it("accepts ordinary names, including accents and other scripts", () => {
    for (const n of ["Asha", "Mary-Ann", "D'Souza", "José", "ಅಶೋಕ್", "Dr. Rao"]) expect(validateFirstName(n)).toEqual({ ok: true, value: n });
  });
  it("trims and collapses spaces", () => {
    expect(validateFirstName("  Asha   Rao ")).toEqual({ ok: true, value: "Asha Rao" });
  });
  it("rejects empty, too long, digits, markup and symbols", () => {
    for (const n of ["", "   ", "A".repeat(31), "Asha2", "<script>", "Asha!", "@asha", "1"]) expect(validateFirstName(n).ok).toBe(false);
  });
});

describe("the 30-second answers form", () => {
  it("needs a starting area and nothing else", () => {
    const r = parseAnswers(form(START));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ start: { name: "Indiranagar", lat: 12.978, lng: 77.641 }, budgetPerPerson: null, dealbreakers: [], vibes: [] });
  });
  it("rejects a missing start area with a clear message", () => {
    const r = parseAnswers(form({ budget: "800" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.start).toMatch(/starting area/);
  });
  it("rejects a start outside Bengaluru", () => {
    const r = parseAnswers(form({ startName: "Delhi", startLat: "28.6", startLng: "77.2" }));
    expect(r.ok).toBe(false);
  });
  it("rounds the pin to about 110 m so it can't point at a doorstep", () => {
    const r = parseAnswers(form({ startName: "Indiranagar", startLat: "12.97841234", startLng: "77.64087654" }));
    if (r.ok) expect(r.value.start).toEqual({ name: "Indiranagar", lat: 12.978, lng: 77.641 });
    else throw new Error("expected ok");
  });
  it("keeps the budget, dealbreakers and mood, and rejects values outside the lists", () => {
    const ok = parseAnswers(form({ ...START, budget: "800", dealbreakers: ["no_alcohol"], vibes: ["Quiet"], maxTravelMin: "30" }));
    expect(ok.ok && ok.value).toMatchObject({ budgetPerPerson: 800, dealbreakers: ["no_alcohol"], vibes: ["Quiet"], maxTravelMin: 30 });
    expect(parseAnswers(form({ ...START, dealbreakers: ["nope"] })).ok).toBe(false);
    expect(parseAnswers(form({ ...START, budget: "1e3" })).ok).toBe(false);
  });
});

const member = (over: Partial<Member>): Member => ({
  id: "m1", planId: "p1", userId: null, firstName: "Asha", role: "member", joinedAt: 1, answeredAt: 2, token: "SECRET-TOKEN",
  answers: { start: { name: "Indiranagar", lat: 12.978, lng: 77.641 }, budgetPerPerson: 1234, cuisines: [], diet: null, spice: null, vibes: [], dealbreakers: [], maxTravelMin: 40 }, ...over,
});

describe("what the lobby may show", () => {
  it("is only first name, role and whether they've answered: never answers, budgets or tokens", () => {
    const view = lobbyView([member({}), member({ id: "m2", firstName: "Ravi", answeredAt: null, answers: null })], "m2");
    expect(view).toEqual([
      { id: "m1", firstName: "Asha", role: "member", answered: true, isYou: false },
      { id: "m2", firstName: "Ravi", role: "member", answered: false, isYou: true },
    ]);
    const text = JSON.stringify(view);
    expect(text).not.toContain("1234");
    expect(text).not.toContain("SECRET");
    expect(text).not.toContain("Indiranagar");
  });
  it("only members who finished the form count as answered, and only they become pool members", () => {
    const list = [member({}), member({ id: "m2", answeredAt: null, answers: null })];
    expect(answeredMembers(list).map((m) => m.id)).toEqual(["m1"]);
    expect(toPoolMember(list[1])).toBeNull();
    expect(toPoolMember(list[0])).toMatchObject({ id: "m1", budget: 1234 });
  });
});
