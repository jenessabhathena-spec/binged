import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { StepShell, Planned } from "@/components/StepShell";
import { Loading } from "@/components/Loading";
import { getPreferences, requireProfile } from "@/lib/auth";
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
  return (
    <StepShell
      step="home"
      title={`Hi ${user.profile.name.split(" ")[0]}, what are we doing?`}
      subtitle={`Starting from ${user.profile.home!.name}.`}
      back="/preferences"
      next={{ href: "/plan/new", label: "Plan with friends" }}
      secondary={{ href: "/solo", label: "Find something for me" }}
    >
      <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">Your tastes</p>
          <p className="truncate font-medium" data-testid="prefs-summary">{summarise(prefs)}</p>
        </div>
        <Link href="/preferences" className="shrink-0 text-sm font-medium text-brand underline">Edit tastes</Link>
      </div>
      <Planned items={["Plan with friends: create a plan and share it on WhatsApp.", "Find something for me: swipe 10 places near you.", "Your active plans appear here."]} />
      <form action={signOut} className="text-center">
        <button className="text-sm text-muted underline">Sign out</button>
      </form>
    </StepShell>
  );
}
