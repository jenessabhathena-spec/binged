import type { Metadata } from "next";
import { StepShell, Planned } from "@/components/StepShell";

export const metadata: Metadata = { title: "Your tastes" };

export default function Preferences() {
  return (
    <StepShell step="preferences" subtitle="Two minutes. Skip anything." back="/profile" next={{ href: "/home", label: "Save and continue" }}>
      <Planned
        items={[
          "Cuisines you like: North Indian, South Indian, Chinese, Asian, Italian, Continental, Cafe, Biryani, Desserts…",
          "Diet: Veg, Non-veg, Jain, Vegan or Eggetarian. Spice: Mild, Medium or Hot.",
          "Usual budget per person (₹ slider). Private: only you can see this.",
          "Vibe: Quiet, Lively, Rooftop, Cafe, Pub, Family.",
          "Dealbreakers: veg options, no alcohol, parking, wheelchair access, max travel time (40 min).",
        ]}
      />
    </StepShell>
  );
}
