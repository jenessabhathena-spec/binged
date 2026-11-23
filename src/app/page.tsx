import { StepShell, Planned } from "@/components/StepShell";

export default function Welcome() {
  return (
    <StepShell
      step="signin"
      title="Agree on one place. Fast."
      subtitle="Everyone swipes. Binged finds the restaurant that's fair for the whole group."
      next={{ href: "/profile", label: "Continue with Google" }}
    >
      <Planned
        items={[
          "Continue with Google: your name, email and photo come from your Google account. No codes to type.",
          "We only use your area and preferences to find fair places for your group.",
        ]}
      />
    </StepShell>
  );
}
