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
