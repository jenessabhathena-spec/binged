import { Suspense } from "react";
import type { Metadata } from "next";
import { StepShell, Planned } from "@/components/StepShell";
import { Loading } from "@/components/Loading";

export const metadata: Metadata = { title: "Who's in" };

export default function Lobby({ params }: PageProps<"/plan/[id]/lobby">) {
  return (
    <Suspense fallback={<Loading />}>
      <LobbyStep params={params} />
    </Suspense>
  );
}

async function LobbyStep({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <StepShell step="lobby" subtitle="Updates live as friends join." back={`/plan/${id}/share`} next={{ href: `/plan/${id}/swipe`, label: "Start picking" }}>
      <Planned
        items={[
          "Who has joined and who has finished, by first name: never their answers.",
          "One meeting point that suits everyone is worked out from all the start areas.",
          "Start picking once 2 or more have answered, or automatically at the deadline.",
        ]}
      />
    </StepShell>
  );
}
