import { Suspense } from "react";
import type { Metadata } from "next";
import { StepShell, Planned } from "@/components/StepShell";
import { Loading } from "@/components/Loading";

export const metadata: Metadata = { title: "Invite friends" };

export default function Share({ params }: PageProps<"/plan/[id]/share">) {
  return (
    <Suspense fallback={<Loading />}>
      <ShareStep params={params} />
    </Suspense>
  );
}

async function ShareStep({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <StepShell
      step="share"
      subtitle="Friends join from the link. No app, no sign-up needed."
      back="/plan/new"
      next={{ href: `/plan/${id}/lobby`, label: "Share on WhatsApp" }}
      secondary={{ href: "/j/demo", label: "Preview what friends see" }}
    >
      <Planned
        items={[
          "A short invite link, hard to guess, that expires after the plan.",
          "\"Share on WhatsApp\" opens WhatsApp with the message ready; \"Copy link\" too.",
          "The link preview shows the plan name and date.",
        ]}
      />
    </StepShell>
  );
}
