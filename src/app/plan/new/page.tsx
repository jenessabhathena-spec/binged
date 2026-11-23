import { Suspense } from "react";
import type { Metadata } from "next";
import { StepShell } from "@/components/StepShell";
import { Loading } from "@/components/Loading";
import { config } from "@/config";
import { requireProfile } from "@/lib/auth";
import { requestTime } from "@/lib/now";
import { nextFridayIST, todayIST } from "@/lib/plans";
import { PlanForm } from "./PlanForm";

export const metadata: Metadata = { title: "Create a plan" };

export default function NewPlan() {
  return (
    <Suspense fallback={<Loading />}>
      <NewPlanStep />
    </Suspense>
  );
}

async function NewPlanStep() {
  await requireProfile(); // also waits for a real request, so "now" below is safe to read
  const now = requestTime();
  const p = config.plan;
  return (
    <StepShell step="new-plan" subtitle="Friends join from a link you share on WhatsApp." back="/home" preview={false}>
      <PlanForm
        defaults={{
          name: p.defaultName, date: nextFridayIST(now), time: p.defaultTime, minDate: todayIST(now),
          partySize: String(p.defaultPartySize), deadlineHours: String(p.defaultDeadlineHours),
        }}
      />
    </StepShell>
  );
}
