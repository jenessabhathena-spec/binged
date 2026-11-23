import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Loading } from "@/components/Loading";
import { PlaceCard } from "@/components/PlaceCard";
import { StepShell } from "@/components/StepShell";
import { winnerActions, winnerShareMessage, mapsPlaceUrl } from "@/lib/booking";
import { toCard } from "@/lib/cards";
import { computeResults, getViewer } from "@/lib/group";
import { requestTime } from "@/lib/now";
import { formatWhen, whatsappUrl } from "@/lib/plans";

export const metadata: Metadata = { title: "Let's go", robots: { index: false } };

export default function Winner({ params }: PageProps<"/plan/[id]/winner">) {
  return (
    <Suspense fallback={<Loading />}>
      <WinnerStep params={params} />
    </Suspense>
  );
}

const btn = "block rounded-2xl py-3.5 text-center font-semibold";

async function WinnerStep({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer(id);
  if (!viewer) notFound();
  const res = await computeResults(id, viewer.member.id, requestTime());
  if (!res) redirect(`/plan/${id}/lobby`);
  if (!res.plan.votingClosedAt) redirect(`/plan/${id}/swipe`);
  if (res.outcome.kind !== "winner") redirect(`/plan/${id}/compare`); // no winner yet: finish the shortlist step first

  const { plan, members, outcome } = res;
  const win = outcome.winner;
  const place = win.entry.place;
  const yesNames = members.filter((m) => win.yes.includes(m.id)).map((m) => m.firstName);
  const voters = members.filter((m) => res.ranking.participants.includes(m.id));
  const opts = { partySize: plan.partySize, startsAt: plan.startsAt };
  const actions = winnerActions(place, opts);
  const shareText = winnerShareMessage(place, plan.startsAt);

  return (
    <StepShell
      step="winner" flow={viewer.isOrganiser ? "organiser" : "friend"} preview={false}
      title={`You're going to ${place.name}`}
      subtitle={`${formatWhen(plan.startsAt)} · ${plan.partySize} people · ${place.area}`}
      back={`/plan/${id}/compare`}
    >
      <div data-testid="winner"><PlaceCard card={toCard(win.entry, voters)} priority /></div>

      <p className="text-sm text-muted">
        {win.full ? "Everyone said yes." : `${win.yesCount} of ${res.ranking.participants.length} said yes (${yesNames.join(", ")}).`}{" "}
        {outcome.via === "full_match" ? "It was the fairest of the places everyone liked." : outcome.via === "tiebreak" ? "It won the final vote." : outcome.via === "organiser" ? "The organiser chose it." : ""}
      </p>

      <section aria-labelledby="where-h" className="rounded-2xl border border-line bg-surface p-4">
        <h2 id="where-h" className="text-sm font-semibold">Where</h2>
        <p className="mt-1 font-medium">{place.name}</p>
        <p className="text-sm text-muted">{place.address ?? `${place.area}, Bengaluru`}</p>
        {!place.address && <p className="mt-1 text-xs text-muted">The street address is on the Google Maps page: tap &ldquo;Open on Google Maps&rdquo;.</p>}
      </section>

      <section aria-labelledby="go-h" className="space-y-2.5">
        <h2 id="go-h" className="text-sm font-semibold">Book or go</h2>
        <a href={actions.book.action.value} target="_blank" rel="noopener noreferrer" className={`${btn} bg-brand text-brand-ink`}>Book a table on Google Maps</a>
        {actions.website && <a href={actions.website.action.value} target="_blank" rel="noopener noreferrer" className={`${btn} border border-line bg-surface`}>Restaurant website</a>}
        {actions.call ? (
          <a href={actions.call.action.value} className={`${btn} border border-line bg-surface`}>{actions.call.label}</a>
        ) : (
          <p className="rounded-2xl border border-dashed border-line px-3.5 py-3 text-center text-sm text-muted" data-testid="no-phone">Phone number not confirmed yet. It&apos;s on the Google Maps page.</p>
        )}
        <a href={actions.directions.value} target="_blank" rel="noopener noreferrer" className={`${btn} border border-line bg-surface`}>Directions</a>
        <a href={whatsappUrl(shareText)} target="_blank" rel="noopener noreferrer" className={`${btn} bg-[#25D366] text-[#07310f]`}>Share on WhatsApp</a>
        <p className="rounded-2xl rounded-tl-sm bg-brand-soft px-3.5 py-3 text-sm" data-testid="share-message">{shareText}</p>
      </section>

      {outcome.runnerUps.length > 0 && (
        <section aria-labelledby="ru-h" className="space-y-2">
          <h2 id="ru-h" className="text-sm font-semibold">Runners-up, in case it&apos;s full</h2>
          <ul className="space-y-2">
            {outcome.runnerUps.map((r) => (
              <li key={r.entry.place.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.entry.place.name}</p>
                  <p className="text-sm text-muted">{r.entry.place.area} · {r.full ? "everyone said yes" : `${r.yesCount} said yes`} · {r.entry.maxTravel} min</p>
                </div>
                <a href={mapsPlaceUrl(r.entry.place)} target="_blank" rel="noopener noreferrer" className="text-sm text-brand underline">Maps</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link href={`/plan/${id}/rate`} className="block text-center text-sm text-brand underline">After the meal: how was it?</Link>
    </StepShell>
  );
}
