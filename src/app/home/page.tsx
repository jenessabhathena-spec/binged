import type { Metadata } from "next";
import { StepShell, Planned } from "@/components/StepShell";

export const metadata: Metadata = { title: "Home" };

export default function Home() {
  return (
    <StepShell
      step="home"
      title="What are we doing?"
      back="/preferences"
      next={{ href: "/plan/new", label: "Plan with friends" }}
      secondary={{ href: "/solo", label: "Find something for me" }}
    >
      <Planned items={["Plan with friends: create a plan and share it on WhatsApp.", "Find something for me: swipe 10 places near you.", "Your active plans appear here."]} />
    </StepShell>
  );
}
