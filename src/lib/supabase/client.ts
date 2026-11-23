"use client";
// Browser Supabase client (anon key only; Row Level Security decides what it can read).
import { createBrowserClient } from "@supabase/ssr";
import { env, isSupabaseConfigured } from "@/lib/env";

export function createClient() {
  if (!isSupabaseConfigured()) return null; // mock mode: no Supabase project yet
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
