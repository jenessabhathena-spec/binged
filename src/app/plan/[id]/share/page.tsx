import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StepShell } from "@/components/StepShell";
import { Loading } from "@/components/Loading";
import { requireProfile } from "@/lib/auth";
import { appOrigin } from "@/lib/origin";
import { planStore } from "@/lib/plan-store";
import { formatWhen, hoursLabel, inviteExpiresAt, inviteUrl, shareMessage, whatsappUrl } from "@/lib/plans";
import { ShareActions } from "./ShareActions";

export const metadata: Metadata = { title: "Invite friends", robots: { index: false } };

export default function Share({ params }: PageProps<"/plan/[id]/share">) {
  return (
    <Suspense fallback={<Loading />}>
      <ShareStep params={params} />
    </Suspense>
  );
}

async function ShareStep({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireProfile();
  const plan = await planStore().getOwned(id, user.id); // only the organiser's own plan
  if (!plan) notFound();

  const link = inviteUrl(await appOrigin(), plan.inviteCode);
  const message = shareMessage(plan.name, link);

  return (
    <StepShell step="share" subtitle="Friends join from the link. No app and no sign-up needed." back="/home" next={{ href: `/plan/${plan.id}/lobby`, label: "Go to the lobby" }} preview={false}>
      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className="text-lg font-bold">{plan.name}</p>
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted">When</dt><dd className="text-right font-medium">{formatWhen(plan.startsAt)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Where</dt><dd className="text-right font-medium">{plan.searchMode === "area" && plan.searchArea ? `Near ${plan.searchArea.name}` : "Anywhere fair"}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">People</dt><dd className="text-right font-medium">{plan.partySize}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Answers close</dt><dd className="text-right font-medium">{formatWhen(plan.deadlineAt)} ({hoursLabel(Math.round((plan.deadlineAt - plan.createdAt) / 3600_000))} from creation)</dd></div>
        </dl>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-semibold">The message</p>
        <p className="rounded-2xl rounded-tl-sm bg-brand-soft px-3.5 py-3 text-sm" data-testid="message">{message}</p>
      </div>

      <ShareActions link={link} whatsapp={whatsappUrl(message)} />

      <p className="text-xs text-muted">The link stops working {formatWhen(inviteExpiresAt(plan))}, 12 hours after the plan starts. It&apos;s long and random, so only people you send it to can open it.</p>
    </StepShell>
  );
}
