import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { StepShell } from "@/components/StepShell";
import { Loading } from "@/components/Loading";
import { requestTime } from "@/lib/now";
import { planStore } from "@/lib/plan-store";
import { formatWhen, INVITE_CODE, publicView, type PublicPlan } from "@/lib/plans";

// What anyone with the link may see: the plan's name, when, who invited them and how many people. A request-time
// lookup (per link). Anything that isn't a live invite shows the same "not available" page.
async function lookup(code: string): Promise<PublicPlan | null> {
  await connection(); // the expiry check reads the clock, so wait for a real request first (Cache Components)
  if (!INVITE_CODE.test(code)) return null;
  const plan = await planStore().getByInvite(code, requestTime());
  return plan ? publicView(plan) : null;
}

// Link previews (WhatsApp, iMessage, ...) read these tags: the plan name, who invited you and when.
export async function generateMetadata({ params }: PageProps<"/j/[code]">): Promise<Metadata> {
  await connection(); // request-time: the plan is looked up per link
  const plan = await lookup((await params).code);
  if (!plan) return { title: "Invite", robots: { index: false, follow: false } };
  const description = `${plan.organiserFirstName} invited you · ${formatWhen(plan.startsAt)}`;
  return {
    title: plan.name,
    description,
    robots: { index: false, follow: false }, // invite links are private: keep them out of search engines
    openGraph: { title: plan.name, description, siteName: "Binged", type: "website" },
    twitter: { card: "summary_large_image", title: plan.name, description },
  };
}

export default function Join({ params }: PageProps<"/j/[code]">) {
  return (
    <Suspense fallback={<Loading />}>
      <JoinStep params={params} />
    </Suspense>
  );
}

async function JoinStep({ params }: { params: Promise<{ code: string }> }) {
  const plan = await lookup((await params).code);
  if (!plan) notFound();
  return (
    <StepShell
      step="join"
      flow="friend"
      title={`${plan.organiserFirstName} invited you`}
      subtitle="30 seconds. Nothing to install."
    >
      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className="text-lg font-bold" data-testid="invite-plan-name">{plan.name}</p>
        <p className="mt-1 text-sm text-muted">{formatWhen(plan.startsAt)} · {plan.partySize} people</p>
      </div>
      <ul className="space-y-2 text-sm text-muted">
        <li>Where you&apos;ll start from: an area or a map pin, never a street address.</li>
        <li>Your budget per person: private, never shown to anyone.</li>
        <li>Dealbreakers and mood. Then everyone swipes on places.</li>
      </ul>
    </StepShell>
  );
}
