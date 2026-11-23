import { Suspense } from "react";
import type { Metadata } from "next";
import { StepShell, Planned } from "@/components/StepShell";
import { Loading } from "@/components/Loading";

export const metadata: Metadata = { title: "Join the plan" };

export default function Join({ params }: PageProps<"/j/[code]">) {
  return (
    <Suspense fallback={<Loading />}>
      <JoinStep params={params} />
    </Suspense>
  );
}

async function JoinStep({ params }: { params: Promise<{ code: string }> }) {
  await params; // the invite code resolves to a plan in M3-M4
  return (
    <StepShell
      step="join"
      flow="friend"
      title="You're invited to Friday dinner"
      subtitle="30 seconds. Nothing to install."
      next={{ href: "/plan/demo/lobby", label: "Continue with Google" }}
      secondary={{ href: "/plan/demo/lobby", label: "Just my first name" }}
    >
      <Planned
        items={[
          "Continue with Google (saves your profile for next time) or just your first name.",
          "Where you'll start from at plan time: area search and map pin, no street address.",
          "Your budget per person: private, never shown to anyone.",
          "Dealbreakers and mood.",
        ]}
      />
    </StepShell>
  );
}
