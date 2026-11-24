"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

// Asks the server for fresh data every few seconds while the tab is visible. It never starts a refresh while the
// previous one is still running: on a slow connection (a tunnel, bad mobile data) overlapping requests cancel each
// other and the page would never update. (In demo mode this is how the lobby "updates live"; Supabase Realtime
// can push instead.)
export function useLiveRefresh(everyMs: number) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const busy = useRef(false);
  useEffect(() => { busy.current = pending; }, [pending]);
  useEffect(() => {
    const t = setInterval(() => {
      if (document.hidden || busy.current) return;
      busy.current = true;
      start(() => router.refresh());
    }, everyMs);
    return () => clearInterval(t);
  }, [router, everyMs]);
}

export function AutoRefresh({ everyMs = 3000 }: { everyMs?: number }) {
  useLiveRefresh(everyMs);
  return null;
}
