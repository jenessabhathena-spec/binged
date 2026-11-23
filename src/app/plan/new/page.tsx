import type { Metadata } from "next";
import { StepShell, Planned } from "@/components/StepShell";

export const metadata: Metadata = { title: "Create a plan" };

export default function NewPlan() {
  return (
    <StepShell step="new-plan" back="/home" next={{ href: "/plan/demo/share", label: "Create plan" }}>
      <Planned
        items={[
          "Plan name (default \"Friday dinner\"), date and time.",
          "Where: \"Anywhere fair\" finds the point that suits everyone's start areas, or pick a locality.",
          "Expected party size (up to 8) and response deadline (default 2 hours).",
        ]}
      />
    </StepShell>
  );
}
