import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Loading } from "@/components/Loading";
import { ShortlistRow } from "@/components/ShortlistRow";
import { StepShell } from "@/components/StepShell";
import { computeResults, getViewer } from "@/lib/group";
import type { Ranked } from "@/lib/matching";
import { requestTime } from "@/lib/now";

export const metadata: Metadata = { title: "Your shortlist", robots: { index: false } };

export default function Results({ params }: PageProps<"/plan/[id]/results">) {
  return (
    <Suspense fallback={<Loading />}>
      <ResultsStep params={params} />
    </Suspense>
  );
}

async function ResultsStep({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer(id);
  if (!viewer) notFound();
  const res = await computeResults(id, viewer.member.id, requestTime());
  if (!res) redirect(`/plan/${id}/lobby`);
  if (!res.plan.votingClosedAt) redirect(`/plan/${id}/swipe`);

  const flow = viewer.isOrganiser ? "organiser" : "friend";
  const { ranking, members } = res;
  // Names in the order people joined, not in id order.
  const yesNames = (r: Ranked) => members.filter((m) => r.yes.includes(m.id)).map((m) => m.firstName);
  const swiped = ranking.participants.length;
  const missing = members.filter((m) => m.answeredAt != null && !ranking.participants.includes(m.id));

  if (res.outcome.kind === "no_match") {
    return (
      <StepShell step="results" flow={flow} preview={false} title="No shortlist this time" subtitle="Nobody said yes to any of the places." back={`/plan/${id}/swipe`} secondary={{ href: "/home", label: "Back to home" }}>
        <p className="text-sm text-muted">That happens. Make a new plan and try a different area, a higher budget or fewer dealbreakers.</p>
      </StepShell>
    );
  }

  return (
    <StepShell
      step="results" flow={flow} preview={false}
      title={`${ranking.shortlist.length} places made your shortlist`}
      subtitle={ranking.fullMatches.length ? `${ranking.fullMatches.length === 1 ? "1 place" : `${ranking.fullMatches.length} places`} everyone said yes to, fairest first.` : "Nobody agreed on a single place, so these are the most popular."}
      back={`/plan/${id}/swipe`}
      next={{ href: `/plan/${id}/compare`, label: "Compare them" }}
    >
      <AutoRefresh everyMs={5000} />
      <ol className="space-y-3" data-testid="shortlist">
        {ranking.shortlist.map((r, i) => <ShortlistRow key={r.entry.place.id} r={r} rank={i + 1} swiped={swiped} yesNames={yesNames(r)} />)}
      </ol>
      {missing.length > 0 && <p className="text-xs text-muted">{missing.map((m) => m.firstName).join(", ")} didn&apos;t swipe, so their votes aren&apos;t counted.</p>}
    </StepShell>
  );
}
