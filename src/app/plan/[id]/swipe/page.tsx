import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { closeVotingAction } from "@/app/actions/group";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Loading } from "@/components/Loading";
import { StepShell } from "@/components/StepShell";
import { toCard } from "@/lib/cards";
import { advance, deckOf, getViewer, progressOf } from "@/lib/group";
import { groupStore } from "@/lib/group-store";
import { requestTime } from "@/lib/now";
import { SwipeDeck } from "./SwipeDeck";

export const metadata: Metadata = { title: "Swipe", robots: { index: false } };

export default function Swipe({ params }: PageProps<"/plan/[id]/swipe">) {
  return (
    <Suspense fallback={<Loading />}>
      <SwipeStep params={params} />
    </Suspense>
  );
}

async function SwipeStep({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer(id);
  if (!viewer) notFound();
  const plan = (await advance(id, requestTime())) ?? viewer.plan;
  if (plan.status === "collecting") redirect(`/plan/${id}/lobby`);
  if (plan.votingClosedAt || plan.status === "decided") redirect(`/plan/${id}/results`);

  const flow = viewer.isOrganiser ? "organiser" : "friend";
  const back = `/plan/${id}/lobby`;
  const store = groupStore();
  const [members, swipes] = await Promise.all([store.listMembers(id), store.listSwipes(id)]);
  const me = members.find((m) => m.id === viewer.member.id) ?? viewer.member;
  const deck = deckOf(plan);

  // Someone who never answered before picking started is out of this round, and is told so.
  if (me.answeredAt == null) {
    return (
      <StepShell step="swipe" flow={flow} preview={false} title="Picking has started" subtitle="You hadn't answered before it began, so you're not part of this round." back={back}>
        <AutoRefresh />
        <p className="text-sm text-muted">The group is swiping now. Ask {plan.organiserFirstName} to start a new plan if you still want in.</p>
      </StepShell>
    );
  }

  const mine = new Set(swipes.filter((s) => s.memberId === me.id).map((s) => s.placeId));
  const remaining = deck.filter((e) => !mine.has(e.place.id));
  const { voters, doneIds } = progressOf(plan, members, swipes);
  const cardMembers = voters.map((m) => ({ id: m.id, firstName: m.firstName }));

  if (remaining.length === 0) {
    return (
      <StepShell step="swipe" flow={flow} preview={false} title="Your swipes are in" subtitle={`${doneIds.size} of ${voters.length} have finished swiping.`} back={back}>
        <AutoRefresh />
        <ul className="space-y-2" data-testid="swipe-progress">
          {voters.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
              <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft font-bold text-brand">{m.firstName.slice(0, 1).toUpperCase()}</span>
              <span className="flex-1 font-medium">{m.firstName}{m.id === me.id && <span className="text-muted"> (you)</span>}</span>
              <span className={`text-sm ${doneIds.has(m.id) ? "text-ok" : "text-muted"}`}>{doneIds.has(m.id) ? "Done ✓" : "Swiping…"}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">Nobody sees anyone else&apos;s swipes until the shortlist. This page moves on by itself when everyone is done.</p>
        {viewer.isOrganiser && (
          <form action={closeVotingAction.bind(null, id)}>
            <button className="w-full rounded-2xl border border-line bg-surface py-3 font-medium">Don&apos;t wait: show the shortlist now</button>
          </form>
        )}
        <Link href={`/plan/${id}/results`} className="block text-center text-sm text-brand underline">Check for the shortlist</Link>
      </StepShell>
    );
  }

  const pool = plan.pool!;
  return (
    <StepShell
      step="swipe" flow={flow} preview={false}
      title={`Swipe ${deck.length} places`}
      subtitle={`Everyone swipes the same places, near ${pool.centerName}. Right for yes, left for no.`}
      back={back}
    >
      {pool.shortfall && <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm">Only {deck.length} places fit everyone&apos;s limits and dealbreakers.</p>}
      <SwipeDeck key={remaining.length} planId={id} cards={remaining.map((e) => toCard(e, cardMembers))} alreadyDone={deck.length - remaining.length} total={deck.length} />
    </StepShell>
  );
}
