import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { StepShell } from "@/components/StepShell";
import { Loading } from "@/components/Loading";
import { getCurrentUser } from "@/lib/auth";
import { getViewer } from "@/lib/group";
import { requestTime } from "@/lib/now";
import { planStore } from "@/lib/plan-store";
import { formatWhen, INVITE_CODE, publicView, type Plan } from "@/lib/plans";
import { JoinChoices, JoinSignedIn } from "./JoinForms";

// A request-time lookup (per link). Anything that isn't a live invite shows the same "not available" page.
async function lookup(code: string): Promise<Plan | null> {
  await connection(); // the expiry check reads the clock, so wait for a real request first (Cache Components)
  if (!INVITE_CODE.test(code)) return null;
  return planStore().getByInvite(code, requestTime());
}

// Link previews (WhatsApp, iMessage, ...) read these tags: the plan name, who invited you and when.
// Only the public fields are used here: never anyone's answers.
export async function generateMetadata({ params }: PageProps<"/j/[code]">): Promise<Metadata> {
  await connection(); // request-time: the plan is looked up per link
  const found = await lookup((await params).code);
  const plan = found ? publicView(found) : null;
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
  const { code } = await params;
  const plan = await lookup(code);
  if (!plan) notFound();
  const pub = publicView(plan);

  const viewer = await getViewer(plan.id); // already in this plan? (guest cookie or signed-in)
  const user = viewer ? null : await getCurrentUser();

  return (
    <StepShell step="join" flow="friend" title={`${pub.organiserFirstName} invited you`} subtitle="30 seconds. Nothing to install." preview={false}>
      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className="text-lg font-bold" data-testid="invite-plan-name">{pub.name}</p>
        <p className="mt-1 text-sm text-muted">{formatWhen(pub.startsAt)} · {pub.partySize} people</p>
      </div>

      {viewer ? (
        <div className="space-y-3">
          <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm">You&apos;re in this plan as <strong>{viewer.member.firstName}</strong>.</p>
          <Link href={`/plan/${plan.id}/${viewer.member.answeredAt ? "lobby" : "me"}`} className="block rounded-2xl bg-brand py-3.5 text-center font-semibold text-brand-ink">
            {viewer.member.answeredAt ? "Go to the lobby" : "Add your answers"}
          </Link>
        </div>
      ) : plan.status !== "collecting" ? (
        <p role="status" className="rounded-xl border border-dashed border-line px-3 py-2 text-sm text-muted">Picking has already started, so new people can&apos;t join this plan.</p>
      ) : user ? (
        <JoinSignedIn code={code} name={user.profile.name.split(" ")[0] || "your name"} />
      ) : (
        <JoinChoices code={code} />
      )}

      <ul className="space-y-2 text-sm text-muted">
        <li>Where you&apos;ll start from: an area or a map pin, never a street address.</li>
        <li>Your budget per person: private, never shown to anyone.</li>
        <li>Dealbreakers and mood. Then everyone swipes on places.</li>
      </ul>
    </StepShell>
  );
}
