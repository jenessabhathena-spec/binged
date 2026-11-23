import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Loading } from "@/components/Loading";
import { StepShell } from "@/components/StepShell";
import { advance, getViewer } from "@/lib/group";
import { groupStore } from "@/lib/group-store";
import { answeredMembers, lobbyView, toPoolMember } from "@/lib/members";
import { requestTime } from "@/lib/now";
import { formatWhen } from "@/lib/plans";
import { meetingPoint } from "@/lib/pool";
import { StartPicking } from "./StartPicking";

export const metadata: Metadata = { title: "Who's in", robots: { index: false } };

export default function Lobby({ params }: PageProps<"/plan/[id]/lobby">) {
  return (
    <Suspense fallback={<Loading />}>
      <LobbyStep params={params} />
    </Suspense>
  );
}

async function LobbyStep({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer(id);
  if (!viewer) notFound();
  const now = requestTime();
  const plan = (await advance(id, now)) ?? viewer.plan; // at the deadline, picking starts by itself
  if (plan.status !== "collecting") redirect(`/plan/${id}/swipe`);

  const members = await groupStore().listMembers(id);
  const me = members.find((m) => m.id === viewer.member.id) ?? viewer.member;
  const lobby = lobbyView(members, me.id); // first names and "answered" only: never anyone's answers
  const answered = answeredMembers(members);
  const canStart = answered.length >= 2;
  // The one place that suits everybody, shown by name once there are two answers. Start points stay private.
  const meeting = canStart ? meetingPoint(answered.map((m) => toPoolMember(m)!), { searchMode: plan.searchMode, searchArea: plan.searchArea }) : null;

  return (
    <StepShell
      step="lobby" flow={viewer.isOrganiser ? "organiser" : "friend"} preview={false}
      title={plan.name}
      subtitle={`${formatWhen(plan.startsAt)} · ${answered.length} of ${plan.partySize} have answered`}
      back={viewer.isOrganiser ? `/plan/${id}/share` : `/j/${plan.inviteCode}`}
    >
      <AutoRefresh />
      <ul className="space-y-2" data-testid="lobby-members">
        {lobby.map((m) => (
          <li key={m.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
            <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft font-bold text-brand">{m.firstName.slice(0, 1).toUpperCase()}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{m.firstName}{m.isYou && <span className="text-muted"> (you)</span>}{m.role === "organiser" && <span className="ml-1.5 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand">organiser</span>}</span>
            <span className={`text-sm ${m.answered ? "text-ok" : "text-muted"}`}>{m.answered ? "Answered ✓" : "Answering…"}</span>
          </li>
        ))}
        {Array.from({ length: Math.max(0, plan.partySize - lobby.length) }, (_, i) => (
          <li key={`open-${i}`} className="rounded-2xl border border-dashed border-line p-3.5 text-sm text-muted">Waiting for someone to join…</li>
        ))}
      </ul>

      {meeting && (
        <p className="rounded-2xl bg-brand-soft px-3.5 py-3 text-sm" data-testid="meeting-area">
          <span className="font-semibold">One meeting area for everyone: {meeting.name}.</span>{" "}
          {plan.searchMode === "area" ? "You chose this area." : "It's the middle of everyone's starting points, and it moves as more people answer."}
        </p>
      )}

      {me.answeredAt == null ? (
        <Link href={`/plan/${id}/me`} className="block rounded-2xl bg-brand py-3.5 text-center font-semibold text-brand-ink">Add your answers</Link>
      ) : viewer.isOrganiser ? (
        <StartPicking planId={id} canStart={canStart} />
      ) : (
        <p role="status" className="rounded-2xl border border-line bg-surface px-3.5 py-3 text-sm">You&apos;re in. Waiting for {plan.organiserFirstName} to start picking. This page moves on by itself.</p>
      )}

      <div className="flex justify-between text-sm">
        {me.answeredAt != null && <Link href={`/plan/${id}/me`} className="text-brand underline">Edit my answers</Link>}
        {viewer.isOrganiser && <Link href={`/plan/${id}/share`} className="text-brand underline">Invite link</Link>}
      </div>

      <p className="text-xs text-muted">Answers close {formatWhen(plan.deadlineAt)}. If at least 2 people have answered by then, picking starts automatically. Anyone who hasn&apos;t answered is left out.</p>
    </StepShell>
  );
}
