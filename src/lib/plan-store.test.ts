import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { planStore } from "@/lib/plan-store";
import { INVITE_CODE, type ValidPlan } from "@/lib/plans";

const HOUR = 3600_000;
const NOW = Date.parse("2026-11-23T10:00:00+05:30");
const valid = (over: Partial<ValidPlan> = {}): ValidPlan => ({
  name: "Friday dinner", startsAt: NOW + 4 * 24 * HOUR, searchMode: "anywhere_fair", searchArea: null, partySize: 4, deadlineAt: NOW + 2 * HOUR, ...over,
});
const asha = { id: "u-asha", firstName: "Asha" }, ravi = { id: "u-ravi", firstName: "Ravi" };

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "binged-plans-"));
  vi.stubEnv("DEMO_DATA_DIR", dir);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

describe("local demo plan store", () => {
  it("creates a plan with a fresh id, a collecting status and an 11-character invite code", async () => {
    const p = await planStore().create(asha, valid(), NOW);
    expect(p).toMatchObject({ organiserId: "u-asha", organiserFirstName: "Asha", name: "Friday dinner", status: "collecting", partySize: 4, createdAt: NOW });
    expect(p.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(INVITE_CODE.test(p.inviteCode)).toBe(true);
  });

  it("gives every plan its own unguessable code", async () => {
    const s = planStore();
    const codes = new Set((await Promise.all(Array.from({ length: 50 }, () => s.create(asha, valid(), NOW)))).map((p) => p.inviteCode));
    expect(codes.size).toBe(50);
  });

  it("an organiser sees only their own plans, and cannot open someone else's by id", async () => {
    const s = planStore();
    const mine = await s.create(asha, valid({ name: "Mine" }), NOW);
    const theirs = await s.create(ravi, valid({ name: "Theirs" }), NOW);
    expect((await s.listActive("u-asha", NOW)).map((p) => p.name)).toEqual(["Mine"]);
    expect(await s.getOwned(mine.id, "u-asha")).toMatchObject({ name: "Mine" });
    expect(await s.getOwned(theirs.id, "u-asha")).toBeNull(); // someone else's plan
    expect(await s.getOwned("not-a-real-id", "u-asha")).toBeNull();
  });

  it("lists active plans soonest first and drops ones whose invite has expired", async () => {
    const s = planStore();
    await s.create(asha, valid({ name: "Later", startsAt: NOW + 5 * 24 * HOUR }), NOW);
    await s.create(asha, valid({ name: "Sooner", startsAt: NOW + 2 * 24 * HOUR }), NOW);
    await s.create(asha, valid({ name: "Long gone", startsAt: NOW - 2 * 24 * HOUR }), NOW - 3 * 24 * HOUR);
    expect((await s.listActive("u-asha", NOW)).map((p) => p.name)).toEqual(["Sooner", "Later"]);
  });

  it("resolves an invite code for anyone, until 12 hours after the plan starts", async () => {
    const s = planStore();
    const p = await s.create(asha, valid(), NOW);
    expect(await s.getByInvite(p.inviteCode, NOW)).toMatchObject({ id: p.id });
    expect(await s.getByInvite(p.inviteCode, p.startsAt + 12 * HOUR)).not.toBeNull();
    expect(await s.getByInvite(p.inviteCode, p.startsAt + 12 * HOUR + 1)).toBeNull(); // expired
    expect(await s.getByInvite("AAAAAAAAAAA", NOW)).toBeNull(); // unknown
  });

  it("counts plans created since a time, per organiser (for the daily limit)", async () => {
    const s = planStore();
    await s.create(asha, valid(), NOW - 30 * HOUR);
    await s.create(asha, valid(), NOW - 2 * HOUR);
    await s.create(asha, valid(), NOW - 1 * HOUR);
    await s.create(ravi, valid(), NOW - 1 * HOUR);
    expect(await s.countSince("u-asha", NOW - 24 * HOUR)).toBe(2);
    expect(await s.countSince("u-ravi", NOW - 24 * HOUR)).toBe(1);
    expect(await s.countSince("u-nobody", 0)).toBe(0);
  });

  it("writes atomically (no temp files left behind) and survives a corrupt file", async () => {
    const s = planStore();
    await s.create(asha, valid(), NOW);
    expect(readdirSync(dir)).toEqual(["plans.json"]);
    expect(JSON.parse(readFileSync(join(dir, "plans.json"), "utf8")).plans).toHaveLength(1);
    writeFileSync(join(dir, "plans.json"), "{ this is not json");
    expect(await s.listActive("u-asha", NOW)).toEqual([]); // no crash
    await s.create(asha, valid(), NOW); // and it recovers
    expect(await s.listActive("u-asha", NOW)).toHaveLength(1);
  });

  it("refuses to run in production, where a local file would not survive a deploy", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(planStore().create(asha, valid(), NOW)).rejects.toThrow(/need Supabase in production/);
  });
});
