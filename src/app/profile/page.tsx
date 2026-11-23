import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { StepShell } from "@/components/StepShell";
import { Loading } from "@/components/Loading";
import { requireUser } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "Your profile" };

export default function Profile() {
  return (
    <Suspense fallback={<Loading />}>
      <ProfileStep />
    </Suspense>
  );
}

async function ProfileStep() {
  const user = await requireUser();
  return (
    <StepShell step="profile" subtitle="So we can work out fair travel times." back="/" preview={false}>
      <ProfileForm key={JSON.stringify(user.profile)} profile={user.profile} />
      <p className="text-center text-sm"><Link href="/preferences" className="font-medium text-brand underline">Edit your tastes and budget</Link></p>
      <form action={signOut} className="pt-2 text-center">
        <button className="text-sm text-muted underline">Not you? Sign out</button>
      </form>
      {user.mode === "demo" && (
        <p className="rounded-xl border border-dashed border-line px-3 py-2 text-xs text-muted">
          Demo mode: your profile is kept in a signed cookie in this browser. <Link href="/privacy" className="underline">Privacy</Link>
        </p>
      )}
    </StepShell>
  );
}
