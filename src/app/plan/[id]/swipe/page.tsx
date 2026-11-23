import { Suspense } from "react";
import type { Metadata } from "next";
import { StepShell, Planned } from "@/components/StepShell";
import { Loading } from "@/components/Loading";
import { SEED_PLACES } from "@/lib/places/seed";
import { config } from "@/config";

export const metadata: Metadata = { title: "Swipe" };

export default function Swipe({ params }: PageProps<"/plan/[id]/swipe">) {
  return (
    <Suspense fallback={<Loading />}>
      <SwipeStep params={params} />
    </Suspense>
  );
}

async function SwipeStep({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <StepShell step="swipe" title={`Swipe ${config.deck.size}+ places`} subtitle="Right for yes, left for no." back={`/plan/${id}/lobby`} next={{ href: `/plan/${id}/results`, label: "See the match" }}>
      <Planned
        items={[
          `Everyone swipes the same deck of ${config.deck.size}+ places, chosen to fit every budget, dealbreaker and travel limit.`,
          "Each card: photo, name, area, cuisine, price per person, rating, each person's travel time, and why it fits.",
          "Swipe right = yes, left = no, with ✓ / ✕ buttons and undo for accessibility.",
          "Nobody sees anyone else's swipes until the result.",
        ]}
      />
      <p className="text-sm text-muted">Sample list ready for mock mode: {SEED_PLACES.length} real Bengaluru restaurants.</p>
    </StepShell>
  );
}
