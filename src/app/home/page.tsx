import { Suspense } from "react";
import type { Metadata } from "next";
import { StepShell, Planned } from "@/components/StepShell";
import { Loading } from "@/components/Loading";
import { requireProfile } from "@/lib/auth";
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
  return (
    <StepShell
      step="home"
      title={`Hi ${user.profile.name.split(" ")[0]}, what are we doing?`}
      subtitle={`Starting from ${user.profile.home!.name}.`}
      back="/preferences"
      next={{ href: "/plan/new", label: "Plan with friends" }}
      secondary={{ href: "/solo", label: "Find something for me" }}
    >
      <Planned items={["Plan with friends: create a plan and share it on WhatsApp.", "Find something for me: swipe 10 places near you.", "Your active plans appear here."]} />
      <form action={signOut} className="text-center">
        <button className="text-sm text-muted underline">Sign out</button>
      </form>
    </StepShell>
  );
}
