import { describe, expect, it } from "vitest";
import { decodeSession, encodeSession, newMockSession } from "@/lib/mock-session";

describe("demo session cookie", () => {
  it("round-trips a session", () => {
    const s = newMockSession("Asha", "asha@gmail.com", 1_000);
    expect(decodeSession(encodeSession(s), 2_000)).toEqual(s);
  });

  it("rejects a cookie whose contents were edited (tampering)", () => {
    const s = newMockSession("Asha", "asha@gmail.com", 1_000);
    const [body, mac] = encodeSession(s).split(".");
    const forged = { ...JSON.parse(Buffer.from(body, "base64url").toString()), id: "someone-else" };
    const forgedBody = Buffer.from(JSON.stringify(forged)).toString("base64url");
    expect(decodeSession(`${forgedBody}.${mac}`, 2_000)).toBeNull();
  });

  it("rejects a cookie signed with the wrong key, junk, and an empty value", () => {
    expect(decodeSession("abc.def")).toBeNull();
    expect(decodeSession("not-a-cookie")).toBeNull();
    expect(decodeSession("")).toBeNull();
    expect(decodeSession(undefined)).toBeNull();
  });

  it("expires after 30 days", () => {
    const s = newMockSession("Asha", "asha@gmail.com", 0);
    const raw = encodeSession(s);
    expect(decodeSession(raw, 29 * 86400_000)).not.toBeNull();
    expect(decodeSession(raw, 31 * 86400_000)).toBeNull();
  });

  it("gives each sign-in its own id", () => {
    expect(newMockSession("A", "a@x.co").id).not.toBe(newMockSession("A", "a@x.co").id);
  });
});

describe("signing key on Vercel with nothing configured", () => {
  it("is derived from the project, so every instance and every deploy of it agrees", async () => {
    const { vi } = await import("vitest");
    vi.stubEnv("MOCK_SESSION_SECRET", "");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_ID", "prj_AAAA");
    const s = newMockSession("Asha", "asha@gmail.com", 1_000);
    const cookie = encodeSession(s);
    expect(decodeSession(cookie, 2_000)).toEqual(s); // same project, same key
    vi.stubEnv("VERCEL_PROJECT_ID", "prj_BBBB");
    expect(decodeSession(cookie, 2_000)).toBeNull(); // a different project has a different key
    vi.unstubAllEnvs();
  });

  it("still refuses to guess a key in production outside Vercel", async () => {
    const { vi } = await import("vitest");
    vi.stubEnv("MOCK_SESSION_SECRET", "");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => encodeSession(newMockSession("Asha", "asha@gmail.com", 1_000))).toThrow(/MOCK_SESSION_SECRET/);
    vi.unstubAllEnvs();
  });
});
