import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { StepShell } from "@/components/StepShell";
import { Loading } from "@/components/Loading";
import { getPreferences, requireProfile } from "@/lib/auth";
import { requestTime } from "@/lib/now";
import { planStore } from "@/lib/plan-store";
import { formatWhen } from "@/lib/plans";
import { summarise } from "@/lib/preferences";
import { signOut } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Home" };

export default function Home() {
  return (
    <Suspense fallback={<Loading />}>
      <HomeStep />
    </Suspense>
  );
}

async function HomeStep() {
  const user = await requireProfile();
  const prefs = await getPreferences(user);
  const plans = await planStore().listActive(user.id, requestTime());
  return (
    <StepShell
      step="home"
      title={`Hi ${user.profile.name.split(" ")[0]}, what are we doing?`}
      subtitle={`Starting from ${user.profile.home!.name}.`}
      back="/preferences"
      preview={false}
      next={{ href: "/plan/new", label: "Plan with friends" }}
      secondary={{ href: "/solo", label: "Find something for me" }}
    >
      <Link href="/demo" className="block rounded-2xl bg-brand-soft p-4" data-testid="home-demo">
        <p className="font-semibold">See how it works: try the demo</p>
        <p className="mt-0.5 text-sm text-muted">A two-minute tour with two pretend friends, built from your own area and tastes. No one to invite.</p>
        <span className="mt-2 inline-block rounded-full bg-brand px-3.5 py-1.5 text-sm font-semibold text-brand-ink">Start the demo</span>
      </Link>
      <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">Your tastes</p>
          <p className="truncate font-medium" data-testid="prefs-summary">{summarise(prefs)}</p>
        </div>
        <Link href="/preferences" className="shrink-0 text-sm font-medium text-brand underline">Edit tastes</Link>
      </div>
      <section aria-labelledby="plans-h">
        <h2 id="plans-h" className="mb-2 text-sm font-semibold">Your plans</h2>
        {plans.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-3.5 py-3 text-sm text-muted">No plans yet. Tap &ldquo;Plan with friends&rdquo; to start one.</p>
        ) : (
          <ul className="space-y-2" data-testid="plan-list">
            {plans.map((p) => (
              <li key={p.id}>
                <Link href={`/plan/${p.id}/lobby`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="text-sm text-muted">{formatWhen(p.startsAt)} · {p.partySize} people</p>
                  </div>
                  <span aria-hidden className="text-muted">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <form action={signOut} className="text-center">
        <button className="text-sm text-muted underline">Sign out</button>
      </form>
    </StepShell>
  );
}
