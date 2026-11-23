import "server-only";
// Demo-mode session (no Supabase project yet): the signed-in person and their profile live in one
// HMAC-signed, httpOnly cookie. Signing stops anyone editing it to become someone else; it is not encrypted,
// but it only ever holds what that same person typed. Replaced entirely by Supabase Auth once configured.
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Profile } from "@/lib/profile";
import type { Preferences } from "@/lib/preferences";

export const MOCK_COOKIE = "binged_demo";
const MAX_AGE_S = 30 * 24 * 3600;

// preferences is optional so cookies issued before M2 still work.
export type MockSession = { v: 1; id: string; issuedAt: number; profile: Profile; preferences?: Preferences };

function secret() {
  const s = process.env.MOCK_SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") throw new Error("MOCK_SESSION_SECRET (32+ characters) is required to run demo mode in production");
  return "binged-dev-only-secret-not-for-production-use";
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const sign = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

export function encodeSession(s: MockSession): string {
  const body = b64(JSON.stringify(s));
  return `${body}.${sign(body)}`;
}

export function decodeSession(raw: string | undefined, now = Date.now()): MockSession | null {
  if (!raw) return null;
  const [body, mac] = raw.split(".");
  if (!body || !mac) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null; // tampered
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as MockSession;
    if (s.v !== 1 || typeof s.id !== "string" || !s.profile) return null;
    if (now - s.issuedAt > MAX_AGE_S * 1000) return null; // expired
    return s;
  } catch {
    return null;
  }
}

export function newMockSession(name: string, email: string, now = Date.now()): MockSession {
  return { v: 1, id: randomUUID(), issuedAt: now, profile: { name, email, avatarUrl: null, home: null, work: null } };
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_S,
};
