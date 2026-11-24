import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mutate, readState } from "@/lib/demo-state";
import type { Plan } from "@/lib/plans";

// A tiny stand-in for Upstash's REST API: MGET and the compare-and-set EVAL, over an in-memory map.
function fakeRedis(opts: { failEvalTimes?: number } = {}) {
  const data = new Map<string, string>();
  let evalFailures = opts.failEvalTimes ?? 0;
  const calls: (string | number)[][] = [];
  const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
    const cmd = JSON.parse(String(init.body)) as (string | number)[];
    calls.push(cmd);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    let result: unknown = null;
    if (cmd[0] === "MGET") result = [data.get(String(cmd[1])) ?? null, data.get(String(cmd[2])) ?? null];
    else if (cmd[0] === "EVAL") {
      const [, , , stateKey, verKey, expected, json] = cmd;
      const current = Number(data.get(String(verKey)) ?? 0);
      if (evalFailures > 0) { evalFailures--; result = 0; }
      else if (current !== Number(expected)) result = 0;
      else { data.set(String(stateKey), String(json)); data.set(String(verKey), String(current + 1)); result = 1; }
    }
    return new Response(JSON.stringify({ result }), { status: 200 });
  });
  return { data, calls, fetchFn };
}

const plan = (id: string): Plan => ({
  id, organiserId: "u1", organiserFirstName: "Asha", name: id, startsAt: 1, searchMode: "anywhere_fair", searchArea: null,
  partySize: 4, deadlineAt: 0, status: "collecting", inviteCode: "x".repeat(11), createdAt: 0,
});

beforeEach(() => {
  vi.stubEnv("KV_REST_API_URL", "https://redis.example.test/");
  vi.stubEnv("KV_REST_API_TOKEN", "tok");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("demo state in Redis", () => {
  it("starts empty, saves a change, and the next read sees it", async () => {
    const r = fakeRedis();
    vi.stubGlobal("fetch", r.fetchFn);
    expect((await readState()).plans).toEqual([]);
    await mutate((s) => { s.plans.push(plan("p1")); });
    expect((await readState()).plans.map((p) => p.id)).toEqual(["p1"]);
  });

  it("returns what the change function returns", async () => {
    vi.stubGlobal("fetch", fakeRedis().fetchFn);
    expect(await mutate((s) => { s.plans.push(plan("p1")); return s.plans.length; })).toBe(1);
  });

  it("retries on a collision and applies the change exactly once on top of the newer data", async () => {
    const r = fakeRedis({ failEvalTimes: 2 });
    vi.stubGlobal("fetch", r.fetchFn);
    let runs = 0;
    await mutate((s) => { runs++; s.plans.push(plan("p1")); });
    expect(runs).toBe(3); // two lost races, then success
    expect((await readState()).plans).toHaveLength(1);
  });

  it("two overlapping changes both survive", async () => {
    vi.stubGlobal("fetch", fakeRedis().fetchFn);
    await Promise.all([mutate((s) => { s.plans.push(plan("a")); }), mutate((s) => { s.plans.push(plan("b")); })]);
    expect((await readState()).plans.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });

  it("gives up with a clear message if it can never win", async () => {
    vi.stubGlobal("fetch", fakeRedis({ failEvalTimes: 99 }).fetchFn);
    await expect(mutate((s) => { s.plans.push(plan("p")); })).rejects.toThrow(/busy/);
  });

  it("sets an expiry so demo data clears itself", async () => {
    const r = fakeRedis();
    vi.stubGlobal("fetch", r.fetchFn);
    await mutate((s) => { s.plans.push(plan("p1")); });
    const evalCall = r.calls.find((c) => c[0] === "EVAL")!;
    expect(Number(evalCall[evalCall.length - 1])).toBe(7 * 24 * 3600);
  });

  it("survives a corrupt document and a Redis error message", async () => {
    const r = fakeRedis();
    r.data.set("binged:demo:state:v1", "{not json");
    vi.stubGlobal("fetch", r.fetchFn);
    expect((await readState()).plans).toEqual([]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "WRONGPASS" }), { status: 401 })));
    await expect(readState()).rejects.toThrow(/Redis/);
  });
});
