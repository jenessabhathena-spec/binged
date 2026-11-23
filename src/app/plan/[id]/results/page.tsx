import { Suspense } from "react";
import type { Metadata } from "next";
import { StepShell, Planned } from "@/components/StepShell";
import { Loading } from "@/components/Loading";

export const metadata: Metadata = { title: "The match" };

export default function Results({ params }: PageProps<"/plan/[id]/results">) {
  return (
    <Suspense fallback={<Loading />}>
      <ResultsStep params={params} />
    </Suspense>
  );
}

async function ResultsStep({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <StepShell step="results" back={`/plan/${id}/swipe`} next={{ href: `/plan/${id}/winner`, label: "Let's go here" }}>
      <Planned
        items={[
          "Places everyone said yes to, ranked by fairness (travel time) then rating.",
          "No full match? The top 2 by yes-count go to a 60-second tie-break; then the organiser decides.",
          "The winner big, plus up to 2 runner-ups, with who said yes and each person's travel time.",
        ]}
      />
    </StepShell>
  );
}
