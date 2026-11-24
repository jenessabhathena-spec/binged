import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CompareTable } from "@/components/CompareTable";
import { Loading } from "@/components/Loading";
import { StepShell } from "@/components/StepShell";
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
  const voters = members.filter((m) => ranking.participants.includes(m.id));
  const yesNames = (r: Ranked) => members.filter((m) => r.yes.includes(m.id)).map((m) => m.firstName);
  const asOption = (r: Ranked) => ({ id: r.entry.place.id, name: r.entry.place.name, area: r.entry.place.area, yes: yesNames(r) });

  return (
    <StepShell
      step="compare" flow={flow} preview={false}
      title="Compare your shortlist"
      subtitle="Side by side. The best value in each row is marked."
      back={`/plan/${id}/results`}
      next={outcome.kind === "winner" ? { href: `/plan/${id}/winner`, label: "Reveal the winner" } : undefined}
    >
      <CompareTable cols={ranking.shortlist} voters={voters} participants={ranking.participants.length} />

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
