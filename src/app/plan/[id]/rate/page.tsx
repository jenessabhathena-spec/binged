import { Suspense } from "react";
import type { Metadata } from "next";
import { StepShell, Planned } from "@/components/StepShell";
import { Loading } from "@/components/Loading";

export const metadata: Metadata = { title: "How was it?" };

export default function Rate({ params }: PageProps<"/plan/[id]/rate">) {
  return (
    <Suspense fallback={<Loading />}>
      <RateStep params={params} />
    </Suspense>
  );
}

async function RateStep({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <StepShell step="rate" back={`/plan/${id}/winner`} next={{ href: "/home", label: "Back to home" }}>
      <Planned items={["Did you go? Yes / No / Went somewhere else.", "A 1-5 rating, used to tune your future picks."]} />
    </StepShell>
  );
}
