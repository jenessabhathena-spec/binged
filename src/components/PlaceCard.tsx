import Image from "next/image";
import type { CardData } from "@/lib/cards";

// One restaurant, as a card. Facts we don't have yet say so instead of showing a made-up number.
export function PlaceCard({ card, priority = false }: { card: CardData; priority?: boolean }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
      <div className="relative h-56 w-full bg-brand-soft">
        {card.photo ? (
          <Image src={card.photo.url} alt={`${card.photo.credit}, not a photo of ${card.name}`} fill sizes="(max-width: 448px) 100vw, 448px" className="object-cover" priority={priority} draggable={false} />
        ) : (
          <div aria-hidden className="grid h-full place-items-center text-5xl">🍽️</div>
        )}
        {card.photo && <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">{card.photo.credit}</span>}
      </div>
      <div className="space-y-2.5 p-4">
        <div>
          <h2 className="text-xl font-bold leading-tight">{card.name}</h2>
          <p className="text-sm text-muted">{card.area} · {card.cuisines.join(", ")}{card.veg === "veg-only" ? " · Pure veg" : ""}</p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span className={card.price ? "font-medium" : "text-muted"}>{card.price ?? "Price: not confirmed yet"}</span>
          <span className={card.rating ? "font-medium" : "text-muted"}>{card.rating ?? "Rating: not confirmed yet"}</span>
        </div>
        <ul className="flex flex-wrap gap-1.5" aria-label="Travel time for each person">
          {card.travel.map((t) => (
            <li key={t.name} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium">{t.name} · {t.minutes} min</li>
          ))}
        </ul>
        <p className="text-sm">{card.reason}</p>
        {card.unconfirmed.length > 0 && <p className="text-xs text-muted">Not confirmed yet: {card.unconfirmed.join(", ")}.</p>}
      </div>
    </div>
  );
}
