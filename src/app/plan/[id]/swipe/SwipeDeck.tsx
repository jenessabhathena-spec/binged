"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { swipeAction, undoSwipeAction } from "@/app/actions/group";
import { PlaceCard } from "@/components/PlaceCard";
import type { CardData } from "@/lib/cards";

const THRESHOLD = 90; // px of drag that counts as a swipe

// Swipe right = yes, left = no. Also ✓ / ✕ buttons, the arrow keys, and undo for the last card.
// Every swipe is saved straight away, so closing the tab and coming back resumes where you were.
export function SwipeDeck({ planId, cards, alreadyDone, total }: { planId: string; cards: CardData[]; alreadyDone: number; total: number }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<{ id: string; liked: boolean }[]>([]);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<null | "yes" | "no">(null);
  const [error, setError] = useState("");
  const start = useRef<{ x: number; id: number } | null>(null);
  const busy = useRef(false);

  const card = cards[index];
  const next = cards[index + 1];
  const done = alreadyDone + index;

  async function commit(liked: boolean) {
    if (!card || busy.current) return;
    busy.current = true;
    setError("");
    setLeaving(liked ? "yes" : "no");
    const saved = swipeAction(planId, card.id, liked);
    await new Promise((r) => setTimeout(r, 180));
    setHistory((h) => [...h, { id: card.id, liked }]);
    setIndex((i) => i + 1);
    setLeaving(null);
    setDx(0);
    busy.current = false;
    const r = await saved;
    if (!r.ok) { setError(r.error === "Voting has closed" ? "Voting has closed." : "That swipe didn't save. Refreshing…"); router.refresh(); }
    else if (index + 1 >= cards.length) router.refresh(); // that was the last card: show who's still swiping
  }

  async function undo() {
    if (busy.current || history.length === 0) return;
    busy.current = true;
    const r = await undoSwipeAction(planId);
    if (r.ok) { setHistory((h) => h.slice(0, -1)); setIndex((i) => Math.max(0, i - 1)); }
    busy.current = false;
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select")) return;
      if (e.key === "ArrowRight") commit(true);
      else if (e.key === "ArrowLeft") commit(false);
      else if (e.key.toLowerCase() === "z") undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!card) return <p role="status" className="text-center text-muted">Saving your swipes…</p>;

  const offset = leaving ? (leaving === "yes" ? 520 : -520) : dx;
  const tilt = offset / 18;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between text-xs text-muted"><span>{done} of {total} swiped</span><span>Right = yes · Left = no</span></div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total}>
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(done / total) * 100}%` }} />
        </div>
      </div>

      <div className="relative" data-testid="deck">
        {next && <div aria-hidden className="pointer-events-none absolute inset-x-3 top-2 scale-[0.97] opacity-60"><PlaceCard card={next} /></div>}
        <div
          className="relative cursor-grab select-none active:cursor-grabbing"
          style={{ transform: `translateX(${offset}px) rotate(${tilt}deg)`, transition: dx === 0 || leaving ? "transform 180ms ease-out" : "none", touchAction: "pan-y" }}
          onPointerDown={(e) => { start.current = { x: e.clientX, id: e.pointerId }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { if (start.current && !leaving) setDx(e.clientX - start.current.x); }}
          onPointerUp={() => { const moved = dx; start.current = null; if (moved > THRESHOLD) commit(true); else if (moved < -THRESHOLD) commit(false); else setDx(0); }}
          onPointerCancel={() => { start.current = null; setDx(0); }}
        >
          <PlaceCard card={card} priority />
          <span aria-hidden className="pointer-events-none absolute left-4 top-4 rounded-lg border-2 border-ok px-2 py-1 text-lg font-extrabold text-ok" style={{ opacity: Math.min(1, Math.max(0, offset / THRESHOLD)) }}>YES</span>
          <span aria-hidden className="pointer-events-none absolute right-4 top-4 rounded-lg border-2 border-red-600 px-2 py-1 text-lg font-extrabold text-red-600" style={{ opacity: Math.min(1, Math.max(0, -offset / THRESHOLD)) }}>NO</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-5">
        <button type="button" onClick={() => commit(false)} aria-label={`No to ${card.name}`} className="grid h-14 w-14 place-items-center rounded-full border border-line bg-surface text-2xl text-red-600 shadow-sm">✕</button>
        <button type="button" onClick={undo} disabled={history.length === 0} aria-label="Undo last swipe" className="grid h-11 w-11 place-items-center rounded-full border border-line bg-surface text-lg shadow-sm disabled:opacity-40">↶</button>
        <button type="button" onClick={() => commit(true)} aria-label={`Yes to ${card.name}`} className="grid h-14 w-14 place-items-center rounded-full bg-ok text-2xl text-white shadow-sm">✓</button>
      </div>
      {error && <p role="alert" className="text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
