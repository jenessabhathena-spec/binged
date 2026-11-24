import Image from "next/image";
import { priceLabel, ratingLabel } from "@/lib/cards";
import type { Ranked } from "@/lib/matching";

// One place on the shortlist: photo, who said yes, and the facts we know. Used by the real results page and the demo.
export function ShortlistRow({ r, rank, swiped, yesNames }: { r: Ranked; rank: number; swiped: number; yesNames: string[] }) {
  const p = r.entry.place;
  return (
    <li className="flex gap-3 rounded-2xl border border-line bg-surface p-3">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-brand-soft">
        {p.photo ? <Image src={p.photo.url} alt="" fill sizes="80px" className="object-cover" /> : <span aria-hidden className="grid h-full place-items-center text-2xl">🍽️</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold leading-tight"><span className="text-muted">{rank}. </span>{p.name}</p>
        <p className="truncate text-sm text-muted">{p.area} · {p.cuisines.join(", ")}</p>
        <p className={`mt-1 text-sm font-medium ${r.full ? "text-ok" : ""}`}>{r.full ? "Everyone said yes ✓" : `${r.yesCount} of ${swiped} said yes`}</p>
        <p className="text-xs text-muted">Yes: {yesNames.join(", ")} · Longest trip {r.entry.maxTravel} min{priceLabel(p.priceRange) ? ` · ${priceLabel(p.priceRange)}` : ""}{ratingLabel(p.rating, p.ratingCount) ? ` · ${ratingLabel(p.rating, p.ratingCount)}` : ""}</p>
      </div>
    </li>
  );
}
