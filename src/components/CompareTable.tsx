import { priceLabel, ratingLabel } from "@/lib/cards";
import type { Ranked } from "@/lib/matching";

type Row = { label: string; cells: { text: string; best?: boolean; muted?: boolean }[] };

const best = <T,>(vals: (T | null)[], better: (a: T, b: T) => boolean) => {
  const known = vals.filter((v): v is T => v !== null);
  return known.length > 1 ? known.reduce((a, b) => (better(b, a) ? b : a)) : null;
};

// The shortlist side by side. The best value in each row is marked. Used by the real compare page and the demo.
export function CompareTable({ cols, voters, participants }: { cols: Ranked[]; voters: { id: string; firstName: string }[]; participants: number }) {
  const rows: Row[] = [];
  const bestYes = Math.max(...cols.map((c) => c.yesCount));
  rows.push({ label: "Said yes", cells: cols.map((c) => ({ text: c.full ? "Everyone ✓" : `${c.yesCount} of ${participants}`, best: c.yesCount === bestYes && cols.length > 1 })) });
  const bestMax = best(cols.map((c) => c.entry.maxTravel), (a, b) => a < b);
  rows.push({ label: "Longest trip", cells: cols.map((c) => ({ text: `${c.entry.maxTravel} min`, best: c.entry.maxTravel === bestMax })) });
  const bestSpread = best(cols.map((c) => c.entry.spread), (a, b) => a < b);
  rows.push({ label: "Gap between trips", cells: cols.map((c) => ({ text: `${c.entry.spread} min`, best: c.entry.spread === bestSpread })) });
  for (const m of voters) {
    const b = best(cols.map((c) => c.entry.travel[m.id] ?? null), (a, c) => a < c);
    rows.push({ label: `${m.firstName}'s trip`, cells: cols.map((c) => ({ text: `${c.entry.travel[m.id]} min`, best: c.entry.travel[m.id] === b })) });
  }
  const bestRating = best(cols.map((c) => c.entry.place.rating), (a, b) => a > b);
  rows.push({ label: "Rating", cells: cols.map((c) => { const t = ratingLabel(c.entry.place.rating, c.entry.place.ratingCount); return { text: t ?? "Not confirmed", muted: !t, best: c.entry.place.rating != null && c.entry.place.rating === bestRating }; }) });
  rows.push({ label: "Price", cells: cols.map((c) => { const t = priceLabel(c.entry.place.priceRange); return { text: t ?? "Not confirmed", muted: !t }; }) });
  rows.push({ label: "Cuisine", cells: cols.map((c) => ({ text: c.entry.place.cuisines.join(", ") })) });
  rows.push({ label: "Area", cells: cols.map((c) => ({ text: c.entry.place.area })) });
  rows.push({ label: "Veg options", cells: cols.map((c) => ({ text: c.entry.place.veg === "veg-only" ? "Pure veg" : c.entry.place.veg === "veg-friendly" ? "Yes" : "Not confirmed", muted: c.entry.place.veg === "unknown" })) });

  return (
    <div className="-mx-4 overflow-x-auto px-4" data-testid="compare-table">
      <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-background p-2 text-left text-xs font-normal text-muted" scope="col"><span className="sr-only">Detail</span></th>
            {cols.map((c) => <th key={c.entry.place.id} scope="col" className="min-w-32 border-b border-line p-2 text-left align-bottom font-bold">{c.entry.place.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row" className="sticky left-0 z-10 whitespace-nowrap border-b border-line bg-background p-2 text-left text-xs font-normal text-muted">{r.label}</th>
              {r.cells.map((cell, i) => (
                <td key={i} className={`border-b border-line p-2 align-top ${cell.best ? "font-semibold text-ok" : cell.muted ? "text-muted" : ""}`}>{cell.best && <span aria-label="best in this row">★ </span>}{cell.text}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
