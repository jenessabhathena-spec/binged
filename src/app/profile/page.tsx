import type { Metadata } from "next";
import { StepShell, Planned } from "@/components/StepShell";

export const metadata: Metadata = { title: "Your profile" };

export default function Profile() {
  return (
    <StepShell step="profile" subtitle="So we can work out fair travel times." back="/" next={{ href: "/preferences", label: "Save and continue" }}>
      <Planned
        items={[
          "Name, filled in from Google (you can edit it). Email shown read-only.",
          "Home area: search a locality and drop a pin on the map (Bengaluru only).",
          "Work area (optional), same picker.",
          "No street address is ever asked for: an area and a pin are enough.",
        ]}
      />
    </StepShell>
  );
}
