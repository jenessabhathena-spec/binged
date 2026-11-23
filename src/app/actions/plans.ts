"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { config } from "@/config";
import { getCurrentUser } from "@/lib/auth";
import { planInputFromForm, validatePlan, type PlanErrors } from "@/lib/plans";
import { planStore } from "@/lib/plan-store";

export type PlanFormValues = { name: string; date: string; time: string; searchMode: string; partySize: string; deadlineHours: string };
export type PlanState = { errors?: PlanErrors; formError?: string; values?: PlanFormValues };

// Everything is validated here on the server. On a problem the typed values are sent back, because React
// resets an uncontrolled form after an action finishes and people shouldn't have to retype a plan.
export async function createPlanAction(_prev: PlanState, fd: FormData): Promise<PlanState> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (!user.profile.home) redirect("/profile");

  const input = planInputFromForm(fd);
  const values: PlanFormValues = { name: input.name, date: input.date, time: input.time, searchMode: input.searchMode, partySize: input.partySize, deadlineHours: input.deadlineHours };
  const now = Date.now();
  const parsed = validatePlan(input, now);
  if (!parsed.ok) return { errors: parsed.errors, values };

  const store = planStore();
  let planId: string;
  try {
    if ((await store.countSince(user.id, now - 24 * 3600_000)) >= config.plan.maxPerOrganiserPerDay) {
      return { formError: "That's a lot of plans for one day. Try again tomorrow.", values };
    }
    planId = (await store.create({ id: user.id, firstName: user.profile.name.split(" ")[0] }, parsed.value, now)).id;
  } catch {
    return { formError: "Couldn't create your plan. Please try again.", values };
  }
  // redirect() works by throwing, so it stays outside the try/catch above.
  revalidatePath("/home");
  redirect(`/plan/${planId}/share`);
}
