import { Suspense } from "react";
import type { Metadata } from "next";
import { StepShell, Planned } from "@/components/StepShell";
import { Loading } from "@/components/Loading";

export const metadata: Metadata = { title: "Let's go" };

export default function Winner({ params }: PageProps<"/plan/[id]/winner">) {
  return (
    <Suspense fallback={<Loading />}>
      <WinnerStep params={params} />
    </Suspense>
  );
}

async function WinnerStep({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <StepShell step="winner" back={`/plan/${id}/results`} next={{ href: `/plan/${id}/rate`, label: "Next day: how was it?" }}>
      <Planned
        items={[
          "Book online: opens the restaurant's Google Maps page (with its reserve button where available) or website.",
          "Call to reserve: phone link. Directions: Google Maps to the restaurant.",
          "Share to WhatsApp: \"We're going to … at 8:30 pm\" with the map link.",
        ]}
      />
    </StepShell>
  );
}
