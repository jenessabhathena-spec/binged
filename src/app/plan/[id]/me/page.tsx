import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { StepShell } from "@/components/StepShell";
import { Loading } from "@/components/Loading";
import { getPreferences } from "@/lib/auth";
import { getViewer } from "@/lib/group";
import { EMPTY_PREFERENCES } from "@/lib/preferences";
import { AnswersForm } from "./AnswersForm";

export const metadata: Metadata = { title: "Your answers", robots: { index: false } };

export default function Me({ params }: PageProps<"/plan/[id]/me">) {
  return (
    <Suspense fallback={<Loading />}>
      <MeStep params={params} />
    </Suspense>
  );
}

async function MeStep({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer(id);
  if (!viewer) notFound();
  const { plan, member, user, isOrganiser } = viewer;
  if (plan.status !== "collecting") redirect(`/plan/${id}/swipe`); // answers are locked once picking starts

  // Pre-filled from what they already told us, else (if signed in) from their profile and saved tastes.
  const prefs = member.answers ?? (user ? { ...(await getPreferences(user)) } : EMPTY_PREFERENCES);
  const start = member.answers?.start ?? user?.profile.home ?? null;

  return (
    <StepShell
      step="me" flow={isOrganiser ? "none" : "friend"} preview={false}
      title={`Hi ${member.firstName}, a few quick questions`}
      subtitle="Takes about 30 seconds. Only your first name and starting area are ever shown to the group."
      back={isOrganiser ? `/plan/${id}/lobby` : `/j/${plan.inviteCode}`}
    >
      <AnswersForm planId={id} start={start} prefs={prefs} editing={member.answeredAt != null} key={JSON.stringify([member.answeredAt, start])} />
    </StepShell>
  );
}
