import type { Metadata } from "next";
import { StepShell, Planned } from "@/components/StepShell";
import { config } from "@/config";

export const metadata: Metadata = { title: "Find something for me" };

export default function Solo() {
  return (
    <StepShell step="solo" flow="none" back="/home" next={{ href: "/plan/demo/winner", label: "Pick my favourite" }}>
      <Planned
        items={[
          `Swipe ${config.deck.size} places near your current or home area.`,
          "Every left swipe brings in a place more like the ones you liked.",
          "Your top yes becomes the pick, with the same Book / Call / Directions actions.",
        ]}
      />
    </StepShell>
  );
}
