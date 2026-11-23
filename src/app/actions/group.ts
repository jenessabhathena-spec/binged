"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { castTieVote, closeVoting, getViewer, guestCookieName, guestCookieOptions, guestCookieValue, organiserChoose, recordSwipe, startPicking, advance } from "@/lib/group";
import { groupStore } from "@/lib/group-store";
import { firstNameOf, parseAnswers, validateFirstName, type AnswersErrors } from "@/lib/members";
import { planStore } from "@/lib/plan-store";
import { INVITE_CODE, type Plan } from "@/lib/plans";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const refresh = (planId: string) => revalidatePath(`/plan/${planId}`, "layout");

export type JoinState = { error?: string; name?: string };

// Can someone still join this plan? Only while answers are being collected and there is room.
async function openPlan(code: string, now: number): Promise<{ plan: Plan } | { error: string }> {
  if (!INVITE_CODE.test(code)) return { error: "This invite isn't available." };
  const plan = await planStore().getByInvite(code, now);
  if (!plan) return { error: "This invite isn't available." };
  if (plan.status !== "collecting") return { error: "Picking has already started, so new people can't join this plan." };
  return { plan };
}

// "Just my first name": a guest with no account. Their secret is kept in an httpOnly cookie for this plan only.
export async function joinAsGuestAction(_prev: JoinState, fd: FormData): Promise<JoinState> {
  const name = validateFirstName(fd.get("firstName"));
  const typed = String(fd.get("firstName") ?? "");
  if (!name.ok) return { error: name.error, name: typed };
  const now = Date.now();
  const opened = await openPlan(String(fd.get("code") ?? ""), now);
  if ("error" in opened) return { error: opened.error, name: typed };
  const { plan } = opened;

  const existing = await getViewer(plan.id);
  if (existing) redirect(existing.member.answeredAt ? `/plan/${plan.id}/lobby` : `/plan/${plan.id}/me`);

  const store = groupStore();
  if ((await store.listMembers(plan.id)).length >= plan.partySize) return { error: `This plan is full (${plan.partySize} people).`, name: typed };
  const member = await store.addMember({ planId: plan.id, userId: null, firstName: name.value, role: "member", answers: null }, now);
  (await cookies()).set(guestCookieName(plan.id), guestCookieValue(member), guestCookieOptions);
  refresh(plan.id);
  redirect(`/plan/${plan.id}/me`);
}

// "Continue with Google" people come back to the invite already signed in: join under their own name.
export async function joinSignedInAction(_prev: JoinState, fd: FormData): Promise<JoinState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  const now = Date.now();
  const opened = await openPlan(String(fd.get("code") ?? ""), now);
  if ("error" in opened) return { error: opened.error };
  const { plan } = opened;
  if (plan.organiserId === user.id) redirect(`/plan/${plan.id}/lobby`);

  const store = groupStore();
  const existing = await store.findByUser(plan.id, user.id);
  if (existing) redirect(existing.answeredAt ? `/plan/${plan.id}/lobby` : `/plan/${plan.id}/me`);
  if ((await store.listMembers(plan.id)).length >= plan.partySize) return { error: `This plan is full (${plan.partySize} people).` };
  await store.addMember({ planId: plan.id, userId: user.id, firstName: firstNameOf(user.profile.name) || "Friend", role: "member", answers: null }, now);
  refresh(plan.id);
  redirect(`/plan/${plan.id}/me`);
}

export type AnswersState = { errors?: AnswersErrors; formError?: string };

// The 30-second form. Validated here; the start area is stored as a name and a rounded pin, never an address.
export async function saveAnswersAction(planId: string, _prev: AnswersState, fd: FormData): Promise<AnswersState> {
  if (!UUID.test(planId)) redirect("/");
  const now = Date.now();
  const viewer = await getViewer(planId);
  if (!viewer) redirect("/");
  if (viewer.plan.status !== "collecting") redirect(`/plan/${planId}/swipe`);
  const parsed = parseAnswers(fd);
  if (!parsed.ok) return { errors: parsed.errors };
  try {
    await groupStore().saveAnswers(planId, viewer.member.id, parsed.value, now);
  } catch {
    return { formError: "Couldn't save your answers. Please try again." };
  }
  refresh(planId);
  redirect(`/plan/${planId}/lobby`);
}

export type StartState = { error?: string };

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state first
export async function startPickingAction(planId: string, _prev: StartState): Promise<StartState> {
  if (!UUID.test(planId)) redirect("/");
  const viewer = await getViewer(planId);
  if (!viewer?.isOrganiser) redirect("/");
  const r = await startPicking(planId, Date.now());
  if (!r.ok) return { error: r.reason };
  refresh(planId);
  redirect(`/plan/${planId}/swipe`);
}

export async function swipeAction(planId: string, placeId: string, liked: boolean): Promise<{ ok: boolean; error?: string }> {
  if (!UUID.test(planId) || typeof placeId !== "string" || placeId.length > 120) return { ok: false, error: "Bad request" };
  const now = Date.now();
  const viewer = await getViewer(planId);
  if (!viewer) return { ok: false, error: "Not in this plan" };
  const plan = (await advance(planId, now)) ?? viewer.plan;
  const r = await recordSwipe(plan, viewer.member, placeId, liked === true, now);
  return r.ok ? { ok: true } : { ok: false, error: r.reason };
}

export async function undoSwipeAction(planId: string): Promise<{ ok: boolean; placeId?: string }> {
  if (!UUID.test(planId)) return { ok: false };
  const viewer = await getViewer(planId);
  if (!viewer || viewer.plan.status !== "group_swiping" || viewer.plan.votingClosedAt) return { ok: false };
  const placeId = await groupStore().undoLastSwipe(planId, viewer.member.id);
  return placeId ? { ok: true, placeId } : { ok: false };
}

export async function closeVotingAction(planId: string): Promise<void> {
  if (!UUID.test(planId)) redirect("/");
  const viewer = await getViewer(planId);
  if (!viewer?.isOrganiser) redirect("/");
  await closeVoting(planId, Date.now());
  refresh(planId);
  redirect(`/plan/${planId}/results`);
}

export async function tieVoteAction(planId: string, placeId: string): Promise<{ ok: boolean }> {
  if (!UUID.test(planId) || typeof placeId !== "string") return { ok: false };
  const viewer = await getViewer(planId);
  if (!viewer) return { ok: false };
  const ok = await castTieVote(viewer.plan, viewer.member, placeId, Date.now());
  refresh(planId);
  return { ok };
}

export async function organiserChooseAction(planId: string, placeId: string): Promise<{ ok: boolean }> {
  if (!UUID.test(planId) || typeof placeId !== "string") return { ok: false };
  const viewer = await getViewer(planId);
  if (!viewer?.isOrganiser) return { ok: false };
  const ok = await organiserChoose(viewer.plan, placeId);
  refresh(planId);
  return { ok };
}
