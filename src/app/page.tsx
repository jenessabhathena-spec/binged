import { Suspense } from "react";
import Link from "next/link";
import { StepShell } from "@/components/StepShell";
import { GoogleButton } from "@/components/GoogleButton";
import { getCurrentUser } from "@/lib/auth";

export default function Welcome({ searchParams }: PageProps<"/">) {
  return (
    <StepShell
      step="signin"
      title="Agree on one place. Fast."
      subtitle="Everyone swipes. Binged finds the restaurant that's fair for the whole group."
      preview={false}
    >
      <Suspense fallback={<div className="h-14" aria-hidden />}>
        <SignInOrContinue searchParams={searchParams} />
      </Suspense>
      <Link href="/demo" className="block rounded-2xl border border-line bg-surface py-3.5 text-center font-semibold" data-testid="try-demo">
        Try the demo <span className="font-normal text-muted">(2 minutes, no sign-in)</span>
      </Link>
      <p className="text-sm text-muted">We only use your area and preferences to find fair places for your group.</p>
      <p className="text-center text-xs text-muted">
        <Link href="/privacy" className="underline">Privacy</Link>
      </p>
    </StepShell>
  );
}

async function SignInOrContinue({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const failed = (await searchParams).signin === "failed";
  const user = await getCurrentUser();
  if (user) {
    return (
      <Link href="/profile" className="block rounded-2xl bg-brand py-3.5 text-center font-semibold text-brand-ink">
        Continue as {user.profile.name || user.profile.email}
      </Link>
    );
  }
  return (
    <>
      {failed && <p role="alert" className="rounded-xl bg-brand-soft px-3 py-2 text-sm">Google sign-in didn&apos;t finish. Please try again.</p>}
      <GoogleButton />
    </>
  );
}
