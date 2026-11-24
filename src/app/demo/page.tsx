import { Suspense } from "react";
import type { Metadata } from "next";
import { getCurrentUser, getPreferences } from "@/lib/auth";
import type { DemoYou } from "@/lib/demo";
import { DemoApp } from "./DemoApp";

export const metadata: Metadata = {
  title: "Try the demo",
  description: "See Binged end to end in two minutes: swipe, shortlist, compare, and a winner. No sign-in.",
};

// Anyone can open the demo with no sign-in (the sample group, shown straight away). If you are signed in and have set
// up your profile, it quietly swaps to a version built from YOUR name, starting area and tastes.
export default function DemoPage() {
  return (
    <Suspense fallback={<DemoApp />}>
      <PersonalDemo />
    </Suspense>
  );
}

async function PersonalDemo() {
  const user = await getCurrentUser();
  const home = user?.profile.home;
  if (!user || !home || !user.profile.name) return <DemoApp />;
  const prefs = await getPreferences(user);
  const you: DemoYou = { firstName: user.profile.name.split(" ")[0], areaName: home.name, start: { lat: home.lat, lng: home.lng }, prefs };
  return <DemoApp you={you} />;
}
