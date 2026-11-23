import "server-only";
// Data access layer for "who is signed in" and their profile. Every page and action goes through here, so
// the Supabase / demo switch lives in one place. Reads cookies: call only inside a <Suspense> boundary.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { decodeSession, encodeSession, MOCK_COOKIE, cookieOptions, type MockSession } from "@/lib/mock-session";
import type { AreaPin, Profile } from "@/lib/profile";

export type CurrentUser = { id: string; mode: "supabase" | "demo"; profile: Profile };

type UserRow = {
  id: string; email: string | null; name: string | null; avatar_url: string | null;
  home_area_name: string | null; home_lat: number | null; home_lng: number | null;
  work_area_name: string | null; work_lat: number | null; work_lng: number | null;
};

const pinFrom = (name: string | null, lat: number | null, lng: number | null): AreaPin | null =>
  name && lat != null && lng != null ? { name, lat, lng } : null;

export async function getCurrentUser(): Promise<CurrentUser | null> {
  // Checking a session compares expiry times with "now". Next requires such values to be deferred to
  // request time (not prerendered into the static shell), so wait for a real request first.
  await connection();
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    if (!supabase) return null;
    const { data: claims } = await supabase.auth.getClaims(); // verifies the session JWT
    const id = claims?.claims?.sub;
    if (!id) return null;
    const { data } = await supabase.from("users").select("*").eq("id", id).maybeSingle<UserRow>();
    if (!data) return null;
    return {
      id, mode: "supabase",
      profile: {
        name: data.name ?? "", email: data.email ?? "", avatarUrl: data.avatar_url,
        home: pinFrom(data.home_area_name, data.home_lat, data.home_lng),
        work: pinFrom(data.work_area_name, data.work_lat, data.work_lng),
      },
    };
  }
  const s = decodeSession((await cookies()).get(MOCK_COOKIE)?.value);
  return s ? { id: s.id, mode: "demo", profile: s.profile } : null;
}

export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/");
  return u;
}

// Signed in AND has finished the profile (name + home area). Later pages need both to work out travel times.
export async function requireProfile(): Promise<CurrentUser> {
  const u = await requireUser();
  if (!u.profile.name || !u.profile.home) redirect("/profile");
  return u;
}

// Saves name and areas for the signed-in person. Email and photo always come from Google, never the form.
export async function saveProfile(u: CurrentUser, v: { name: string; home: AreaPin; work: AreaPin | null }) {
  if (u.mode === "supabase") {
    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase is not configured");
    const { error } = await supabase.from("users").update({
      name: v.name,
      home_area_name: v.home.name, home_lat: v.home.lat, home_lng: v.home.lng,
      work_area_name: v.work?.name ?? null, work_lat: v.work?.lat ?? null, work_lng: v.work?.lng ?? null,
    }).eq("id", u.id); // Row Level Security also limits this to the caller's own row
    if (error) throw new Error("Couldn't save your profile");
    return;
  }
  const store = await cookies();
  const s = decodeSession(store.get(MOCK_COOKIE)?.value);
  if (!s) throw new Error("Signed out");
  const next: MockSession = { ...s, profile: { ...s.profile, name: v.name, home: v.home, work: v.work } };
  store.set(MOCK_COOKIE, encodeSession(next), cookieOptions);
}
