import { Suspense } from "react";
import type { Metadata } from "next";
import { StepShell } from "@/components/StepShell";
import { Loading } from "@/components/Loading";
import { getPreferences, requireProfile } from "@/lib/auth";
import { PreferencesForm } from "./PreferencesForm";

export const metadata: Metadata = { title: "Your tastes" };

export default function Preferences() {
  return (
    <Suspense fallback={<Loading />}>
      <PreferencesStep />
    </Suspense>
  );
}

async function PreferencesStep() {
  const user = await requireProfile(); // needs a signed-in person with a home area
  const prefs = await getPreferences(user);
  return (
    <StepShell step="preferences" subtitle="Two minutes. Every question is optional, and you can change these any time." back="/profile" preview={false}>
      {/* key: remount the form when the saved data changes, so its checkboxes show the new values */}
      <PreferencesForm key={JSON.stringify(prefs)} prefs={prefs} />
    </StepShell>
  );
}
