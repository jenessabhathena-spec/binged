"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Keeps a waiting screen live: asks the server for fresh data every few seconds while the tab is visible.
// (In demo mode this is how the lobby "updates live"; with Supabase, Realtime can push instead.)
export function AutoRefresh({ everyMs = 3000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) router.refresh(); }, everyMs);
    return () => clearInterval(t);
  }, [router, everyMs]);
  return null;
}
