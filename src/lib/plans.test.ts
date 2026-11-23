import { describe, expect, it } from "vitest";
import {
  formatWhen, inviteExpired, inviteUrl, isActive, istToEpoch, nextFridayIST, planInputFromForm, publicView,
  shareMessage, todayIST, validatePlan, whatsappUrl, INVITE_CODE, type Plan, type PlanInput,
} from "@/lib/plans";

const IST = (s: string) => Date.parse(s + "+05:30");
const NOW = IST("2026-11-23T10:00:00"); // a Monday, 10:00 in Bengaluru

const good: PlanInput = { name: "Friday dinner", date: "2026-11-27", time: "20:00", searchMode: "anywhere_fair", searchArea: null, partySize: "4", deadlineHours: "2" };

describe("IST time helpers", () => {
  it("converts a Bengaluru date and time to an instant", () => {
    expect(istToEpoch("2026-11-27", "20:00")).toBe(Date.parse("2026-11-27T14:30:00Z"));
  });

  it("todayIST uses Bengaluru's date, not UTC's (just after midnight IST it is still yesterday in UTC)", () => {
    expect(todayIST(IST("2026-11-28T00:30:00"))).toBe("2026-11-28");
    expect(new Date(IST("2026-11-28T00:30:00")).toISOString().slice(0, 10)).toBe("2026-11-27");
  });

  it("finds the next Friday, and rolls to the following week once this Friday's default time has passed", () => {
    expect(nextFridayIST(IST("2026-11-23T10:00:00"))).toBe("2026-11-27"); // Monday
    expect(nextFridayIST(IST("2026-11-27T10:00:00"))).toBe("2026-11-27"); // Friday morning: tonight
    expect(nextFridayIST(IST("2026-11-27T20:00:00"))).toBe("2026-12-04"); // Friday 8pm: too late for 8pm tonight
    expect(nextFridayIST(IST("2026-11-28T09:00:00"))).toBe("2026-12-04"); // Saturday
  });

  it("formats the time for people", () => {
    expect(formatWhen(IST("2026-11-27T20:00:00"))).toBe("Fri 27 Nov, 8:00 pm");
    expect(formatWhen(IST("2026-12-04T13:05:00"))).toBe("Fri 4 Dec, 1:05 pm");
  });
});

describe("validatePlan", () => {
  it("accepts a good plan, computing the start and the answer deadline", () => {
    const r = validatePlan(good, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual({ name: "Friday dinner", startsAt: IST("2026-11-27T20:00:00"), searchMode: "anywhere_fair", searchArea: null, partySize: 4, deadlineAt: NOW + 2 * 3600_000 });
    }
  });

  it("tidies the name and requires one", () => {
    expect(validatePlan({ ...good, name: "  Biryani   night " }, NOW)).toMatchObject({ ok: true, value: { name: "Biryani night" } });
    expect(validatePlan({ ...good, name: "  " }, NOW)).toMatchObject({ ok: false, errors: { name: expect.any(String) } });
    expect(validatePlan({ ...good, name: "x".repeat(51) }, NOW)).toMatchObject({ ok: false, errors: { name: expect.any(String) } });
  });

  it.each([
    ["a time in the past", "2026-11-20", "20:00"],
    ["less than 30 minutes from now", "2026-11-23", "10:20"],
    ["more than 60 days ahead", "2027-03-01", "20:00"],
    ["a date that doesn't exist", "2026-02-31", "20:00"],
    ["a malformed date", "27/11/2026", "20:00"],
    ["a malformed time", "2026-11-27", "8pm"],
    ["an impossible time", "2026-11-27", "25:00"],
  ])("rejects %s", (_label, date, time) => {
    const r = validatePlan({ ...good, date, time }, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.when).toBeTruthy();
  });

  it("the 30-minute rule is exact: 10:29 is too soon, 10:31 is fine as a start time", () => {
    const soon = validatePlan({ ...good, date: "2026-11-23", time: "10:29" }, NOW);
    expect(soon.ok === false && soon.errors.when).toMatch(/30 minutes/);
    // 10:31 is a valid start. (Any answer window would still end too close to it, so only the time is checked.)
    const fine = validatePlan({ ...good, date: "2026-11-23", time: "10:31", deadlineHours: "1" }, NOW);
    expect(fine.ok === false && fine.errors.when).toBeUndefined();
    expect(fine.ok === false && fine.errors.deadline).toBeTruthy();
  });

  it("answers must close before the plan starts", () => {
    // Plan at 12:00 today (2h away): a 2-hour window would end at start, inside the 15-minute buffer.
    const r = validatePlan({ ...good, date: "2026-11-23", time: "12:00", deadlineHours: "2" }, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.deadline).toMatch(/starts before/);
    expect(validatePlan({ ...good, date: "2026-11-23", time: "12:00", deadlineHours: "1" }, NOW).ok).toBe(true);
  });

  it("limits the party to 2-8 and the window to the listed choices", () => {
    for (const bad of ["1", "9", "0", "abc", "4.5", "", "-3"]) expect(validatePlan({ ...good, partySize: bad }, NOW).ok, `party ${bad}`).toBe(false);
    for (const ok of ["2", "8"]) expect(validatePlan({ ...good, partySize: ok }, NOW).ok).toBe(true);
    for (const bad of ["3", "0", "48", "x", ""]) expect(validatePlan({ ...good, deadlineHours: bad }, NOW).ok, `window ${bad}`).toBe(false);
  });

  it("'area' mode needs a Bengaluru area; 'anywhere fair' stores none", () => {
    const area = { name: "Indiranagar", lat: 12.97841, lng: 77.64083 };
    const r = validatePlan({ ...good, searchMode: "area", searchArea: area }, NOW);
    expect(r).toMatchObject({ ok: true, value: { searchMode: "area", searchArea: { name: "Indiranagar", lat: 12.978, lng: 77.641 } } });
    expect(validatePlan({ ...good, searchMode: "area", searchArea: null }, NOW).ok).toBe(false);
    expect(validatePlan({ ...good, searchMode: "area", searchArea: { name: "Delhi", lat: 28.6, lng: 77.2 } }, NOW).ok).toBe(false);
    // An area sent with "anywhere fair" is ignored, not stored.
    expect(validatePlan({ ...good, searchMode: "anywhere_fair", searchArea: area }, NOW)).toMatchObject({ ok: true, value: { searchArea: null } });
    expect(validatePlan({ ...good, searchMode: "nearby" }, NOW).ok).toBe(false);
  });
});

describe("planInputFromForm", () => {
  it("reads the plan fields and the area pin, and nothing else", () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries({ name: "X", date: "2026-11-27", time: "20:00", searchMode: "area", searchName: "Indiranagar", searchLat: "12.978", searchLng: "77.641", partySize: "4", deadlineHours: "2", organiserId: "someone-else", status: "decided" })) fd.set(k, v);
    const input = planInputFromForm(fd);
    expect(Object.keys(input).sort()).toEqual(["date", "deadlineHours", "name", "partySize", "searchArea", "searchMode", "time"]);
    expect(input.searchArea).toEqual({ name: "Indiranagar", lat: 12.978, lng: 77.641 });
  });
});

describe("invite link and sharing", () => {
  const plan: Plan = {
    id: "p1", organiserId: "u1", organiserFirstName: "Asha", name: "Friday dinner", startsAt: IST("2026-11-27T20:00:00"),
    searchMode: "area", searchArea: { name: "Koramangala", lat: 12.935, lng: 77.625 }, partySize: 4, deadlineAt: NOW, status: "collecting",
    inviteCode: "AbCdEfGhIjK", createdAt: NOW,
  };

  it("expires 12 hours after the plan starts, not before", () => {
    expect(inviteExpired(plan, plan.startsAt)).toBe(false);
    expect(inviteExpired(plan, plan.startsAt + 12 * 3600_000)).toBe(false);
    expect(inviteExpired(plan, plan.startsAt + 12 * 3600_000 + 1)).toBe(true);
    expect(isActive(plan, NOW)).toBe(true);
    expect(isActive({ ...plan, status: "closed" }, NOW)).toBe(false);
    expect(isActive(plan, plan.startsAt + 13 * 3600_000)).toBe(false);
  });

  it("the public view never includes the organiser's id, the search area or the invite code", () => {
    const v = publicView(plan);
    expect(Object.keys(v).sort()).toEqual(["name", "organiserFirstName", "partySize", "startsAt"]);
    expect(JSON.stringify(v)).not.toMatch(/Koramangala|u1|AbCdEfGhIjK/);
  });

  it("builds the SPEC wording and a WhatsApp link that survives special characters", () => {
    const url = inviteUrl("https://binged.example/", plan.inviteCode);
    expect(url).toBe("https://binged.example/j/AbCdEfGhIjK");
    const msg = shareMessage("Friday dinner", url);
    expect(msg).toBe("Join my Binged plan for Friday dinner — takes 30 seconds: https://binged.example/j/AbCdEfGhIjK");
    const wa = whatsappUrl(shareMessage("Dosa & chai, 50% off?", url));
    expect(wa.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(wa.slice("https://wa.me/?text=".length))).toContain("Dosa & chai, 50% off?");
    expect(wa).not.toMatch(/ |&chai/); // spaces and & are encoded
  });

  it("only 11-character URL-safe strings count as invite codes", () => {
    expect(INVITE_CODE.test("AbCdEfGhIjK")).toBe(true);
    expect(INVITE_CODE.test("short")).toBe(false);
    expect(INVITE_CODE.test("AbCdEfGhIjK/")).toBe(false);
    expect(INVITE_CODE.test("../../etc/pw")).toBe(false);
    expect(INVITE_CODE.test("")).toBe(false);
  });
});
