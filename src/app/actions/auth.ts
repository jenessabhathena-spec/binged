"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { encodeSession, newMockSession, MOCK_COOKIE, cookieOptions } from "@/lib/mock-session";

export type DemoSignInState = { error?: string; name?: string; email?: string };

// Demo stand-in for "Continue with Google" while no Supabase project exists. It asks for exactly what
// Google would give us (name and email) and nothing more. Disabled once Supabase is configured.
export async function demoSignIn(_prev: DemoSignInState, fd: FormData): Promise<DemoSignInState> {
  if (isSupabaseConfigured()) return { error: "Demo sign-in is off: use Continue with Google." };
  const name = String(fd.get("name") ?? "").trim().replace(/\s+/g, " ");
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!name || name.length > 60) return { error: "Enter your name (up to 60 characters)", name, email };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) return { error: "Enter a valid email address", name, email };
  (await cookies()).set(MOCK_COOKIE, encodeSession(newMockSession(name, email)), cookieOptions);
  redirect("/profile");
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase?.auth.signOut();
  }
  (await cookies()).delete(MOCK_COOKIE);
  redirect("/");
}
