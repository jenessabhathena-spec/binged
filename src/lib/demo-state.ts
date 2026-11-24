import "server-only";
// Demo mode (no Supabase yet): all plans, members, swipes and votes live in ONE small JSON document. Where that
// document is kept depends on where the app runs:
//  - Redis, when a Redis REST address and token are set (Vercel's Upstash integration sets KV_REST_API_URL and
//    KV_REST_API_TOKEN). Shared by every server instance, so a plan made on one request is there on the next.
//  - On Vercel with no Redis: the server's /tmp. That belongs to one instance and is wiped when it is recycled,
//    so plans can vanish. Better than nothing for a first try; Redis is the fix.
//  - A local file, .data/plans.json, for development. Production elsewhere refuses to run this demo store.
// Every change goes through mutate(): read, change, write back. Files write atomically (temp file + rename); Redis
// writes are compare-and-set on a version number, retried if two requests collide.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { redisRest } from "@/lib/env";
import type { Member } from "@/lib/members";
import type { Plan } from "@/lib/plans";

export type StoredSwipe = { planId: string; memberId: string; placeId: string; liked: boolean; at: number };
export type StoredTieVote = { planId: string; memberId: string; placeId: string };
export type DemoState = { plans: Plan[]; members: Member[]; swipes: StoredSwipe[]; tieVotes: StoredTieVote[] };

const empty = (): DemoState => ({ plans: [], members: [], swipes: [], tieVotes: [] });

function normalise(d: unknown): DemoState {
  const o = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
  const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
  return { plans: arr(o.plans), members: arr(o.members), swipes: arr(o.swipes), tieVotes: arr(o.tieVotes) };
}

// ---------- Redis (shared) ----------

const redisConfig = redisRest;

const STATE_KEY = "binged:demo:state:v1";
const VERSION_KEY = "binged:demo:version:v1";
const TTL_SECONDS = 7 * 24 * 3600; // demo data clears itself after a week of no changes

// Replaces the state only if nobody else changed it since we read it (the version still matches).
const COMPARE_AND_SET = `
local v = tonumber(redis.call('GET', KEYS[2]) or '0')
if v ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
redis.call('SET', KEYS[2], tostring(v + 1), 'EX', ARGV[3])
return 1`;

async function redisCommand(cfg: { url: string; token: string }, command: (string | number)[]): Promise<unknown> {
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
  if (!res.ok || body.error) throw new Error(`Redis: ${body.error ?? res.status}`);
  return body.result;
}

async function redisRead(cfg: { url: string; token: string }): Promise<{ state: DemoState; version: number }> {
  const [raw, ver] = (await redisCommand(cfg, ["MGET", STATE_KEY, VERSION_KEY])) as [string | null, string | null];
  let state = empty();
  if (raw) { try { state = normalise(JSON.parse(raw)); } catch { /* a corrupt document should not take the app down */ } }
  return { state, version: Number(ver ?? 0) };
}

async function redisMutate<T>(cfg: { url: string; token: string }, fn: (s: DemoState) => T): Promise<T> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { state, version } = await redisRead(cfg);
    const result = fn(state);
    const ok = await redisCommand(cfg, ["EVAL", COMPARE_AND_SET, 2, STATE_KEY, VERSION_KEY, version, JSON.stringify(state), TTL_SECONDS]);
    if (Number(ok) === 1) return result;
    await new Promise((r) => setTimeout(r, 15 + Math.random() * 60)); // someone else wrote first: read again and redo
  }
  throw new Error("The demo database is busy. Please try again.");
}

// ---------- files (local, or /tmp on Vercel without Redis) ----------

function dir() {
  const onVercel = Boolean(process.env.VERCEL);
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_STORE !== "1" && !onVercel) {
    throw new Error("Plans need Supabase in production. The local demo store is for development only.");
  }
  if (process.env.DEMO_DATA_DIR) return process.env.DEMO_DATA_DIR;
  if (onVercel) return join(tmpdir(), "binged-demo");
  return join(process.cwd(), ".data");
}

function fileRead(): DemoState {
  const file = join(dir(), "plans.json");
  if (!existsSync(file)) return empty();
  try {
    return normalise(JSON.parse(readFileSync(file, "utf8")));
  } catch {
    return empty(); // a corrupt demo file should not take the app down
  }
}

function fileMutate<T>(fn: (s: DemoState) => T): T {
  const s = fileRead();
  const result = fn(s);
  const d = dir();
  mkdirSync(d, { recursive: true });
  const file = join(d, "plans.json"), tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(s, null, 2));
  renameSync(tmp, file); // atomic replace: a crash mid-write cannot leave half a file
  return result;
}

// ---------- the two functions the stores use ----------

export async function readState(): Promise<DemoState> {
  const cfg = redisConfig();
  return cfg ? (await redisRead(cfg)).state : fileRead();
}

export async function mutate<T>(fn: (s: DemoState) => T): Promise<T> {
  const cfg = redisConfig();
  return cfg ? redisMutate(cfg, fn) : fileMutate(fn);
}
