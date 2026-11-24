import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Loading } from "@/components/Loading";
import { StepShell } from "@/components/StepShell";
import { WinnerPanel } from "@/components/WinnerPanel";
import { computeResults, getViewer } from "@/lib/group";
import { requestTime } from "@/lib/now";
import { formatWhen } from "@/lib/plans";

export const metadata: Metadata = { title: "Let's go", robots: { index: false } };

export default function Winner({ params }: PageProps<"/plan/[id]/winner">) {
  return (
    <Suspense fallback={<Loading />}>
      <WinnerStep params={params} />
    </Suspense>
  );
}

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
  const voters = members.filter((m) => res.ranking.participants.includes(m.id));
  const yesNames = members.filter((m) => win.yes.includes(m.id)).map((m) => m.firstName);

  return (
    <StepShell
      step="winner" flow={viewer.isOrganiser ? "organiser" : "friend"} preview={false}
      title={`You're going to ${win.entry.place.name}`}
      subtitle={`${formatWhen(plan.startsAt)} · ${plan.partySize} people · ${win.entry.place.area}`}
      back={`/plan/${id}/compare`}
    >
      <WinnerPanel outcome={outcome} voters={voters} yesNames={yesNames} participants={res.ranking.participants.length} plan={{ startsAt: plan.startsAt, partySize: plan.partySize }} />
      <Link href={`/plan/${id}/rate`} className="block text-center text-sm text-brand underline">After the meal: how was it?</Link>
      {viewer.user && <Link href="/home" className="block text-center text-sm text-brand underline">Back to home (plan another dinner, or sign out)</Link>}
    </StepShell>
  );
}
