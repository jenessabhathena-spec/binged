import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Loading } from "@/components/Loading";
import { StepShell } from "@/components/StepShell";
import { priceLabel, ratingLabel } from "@/lib/cards";
import { computeResults, getViewer } from "@/lib/group";
import type { Ranked } from "@/lib/matching";
import { requestTime } from "@/lib/now";
import { TieBreak } from "./TieBreak";

export const metadata: Metadata = { title: "Compare", robots: { index: false } };

export default function Compare({ params }: PageProps<"/plan/[id]/compare">) {
  return (
    <Suspense fallback={<Loading />}>
      <CompareStep params={params} />
    </Suspense>
  );
}

async function CompareStep({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer(id);
  if (!viewer) notFound();
  const res = await computeResults(id, viewer.member.id, requestTime());
  if (!res) redirect(`/plan/${id}/lobby`);
  if (!res.plan.votingClosedAt) redirect(`/plan/${id}/swipe`);
  if (res.outcome.kind === "no_match") redirect(`/plan/${id}/results`);

  const flow = viewer.isOrganiser ? "organiser" : "friend";
  const { ranking, members, outcome, tie } = res;
  const cols = ranking.shortlist;
  const voters = members.filter((m) => ranking.participants.includes(m.id));
  const yesNames = (r: Ranked) => members.filter((m) => r.yes.includes(m.id)).map((m) => m.firstName);

  // Every row is a fact about each place. The best value in a row is marked, so differences stand out.
  type Row = { label: string; cells: { text: string; best?: boolean; muted?: boolean }[] };
  const best = <T,>(vals: (T | null)[], better: (a: T, b: T) => boolean) => {
    const known = vals.filter((v): v is T => v !== null);
    return known.length > 1 ? known.reduce((a, b) => (better(b, a) ? b : a)) : null;
  };
  const rows: Row[] = [];
  const bestYes = Math.max(...cols.map((c) => c.yesCount));
  rows.push({ label: "Said yes", cells: cols.map((c) => ({ text: c.full ? "Everyone ✓" : `${c.yesCount} of ${ranking.participants.length}`, best: c.yesCount === bestYes && cols.length > 1 })) });
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

  const asOption = (r: Ranked) => ({ id: r.entry.place.id, name: r.entry.place.name, area: r.entry.place.area, yes: yesNames(r) });

  return (
    <StepShell
      step="compare" flow={flow} preview={false}
      title="Compare your shortlist"
      subtitle="Side by side. The best value in each row is marked."
      back={`/plan/${id}/results`}
      next={outcome.kind === "winner" ? { href: `/plan/${id}/winner`, label: "Reveal the winner" } : undefined}
    >
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

      {outcome.kind === "tiebreak" && tie && (
        <TieBreak planId={id} options={[asOption(outcome.options[0]), asOption(outcome.options[1])]} endsAt={tie.endsAt} voted={tie.voted} voters={tie.voters} myVote={tie.myVote} closed={false} isOrganiser={viewer.isOrganiser} />
      )}
      {outcome.kind === "organiser_decides" && tie && (
        <TieBreak planId={id} options={[asOption(outcome.options[0]), asOption(outcome.options[1])]} endsAt={tie.endsAt} voted={tie.voted} voters={tie.voters} myVote={tie.myVote} closed isOrganiser={viewer.isOrganiser} />
      )}
      {outcome.kind === "winner" && (
        <p className="rounded-2xl bg-brand-soft px-3.5 py-3 text-sm">
          {outcome.via === "full_match" ? "Everyone said yes to at least one place, so the fairest of those wins." : outcome.via === "tiebreak" ? "The final vote is in." : outcome.via === "organiser" ? "The organiser made the call." : "Only one place got a yes."}
        </p>
      )}
      <Link href={`/plan/${id}/results`} className="block text-center text-sm text-brand underline">Back to the shortlist</Link>
    </StepShell>
  );
}
