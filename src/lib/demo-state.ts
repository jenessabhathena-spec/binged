import "server-only";
// Demo mode (no Supabase yet): everything lives in one local JSON file, .data/plans.json, so an invite link can
// be opened in a different browser (a cookie cannot do that). Development only: it refuses to run in production.
// Every change goes through mutate(): read, change, write back atomically (temp file + rename).
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Member } from "@/lib/members";
import type { Plan } from "@/lib/plans";

export type StoredSwipe = { planId: string; memberId: string; placeId: string; liked: boolean; at: number };
export type StoredTieVote = { planId: string; memberId: string; placeId: string };
export type DemoState = { plans: Plan[]; members: Member[]; swipes: StoredSwipe[]; tieVotes: StoredTieVote[] };

function dir() {
  // Vercel's disk is read-only except /tmp, which belongs to one server instance and is wiped when it is recycled.
  // So on Vercel the demo database is best-effort: it works while friends are using it, and may vanish later.
  const onVercel = Boolean(process.env.VERCEL);
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_STORE !== "1" && !onVercel) {
    throw new Error("Plans need Supabase in production. The local demo store is for development only.");
  }
  if (process.env.DEMO_DATA_DIR) return process.env.DEMO_DATA_DIR;
  if (onVercel) return join(tmpdir(), "binged-demo");
  return join(process.cwd(), ".data");
}

export function readState(): DemoState {
  const file = join(dir(), "plans.json");
  const empty: DemoState = { plans: [], members: [], swipes: [], tieVotes: [] };
  if (!existsSync(file)) return empty;
  try {
    const d = JSON.parse(readFileSync(file, "utf8"));
    const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
    return { plans: arr(d.plans), members: arr(d.members), swipes: arr(d.swipes), tieVotes: arr(d.tieVotes) };
  } catch {
    return empty; // a corrupt demo file should not take the app down
  }
}

export function mutate<T>(fn: (s: DemoState) => T): T {
  const s = readState();
  const result = fn(s);
  const d = dir();
  mkdirSync(d, { recursive: true });
  const file = join(d, "plans.json"), tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(s, null, 2));
  renameSync(tmp, file); // atomic replace: a crash mid-write cannot leave half a file
  return result;
}
