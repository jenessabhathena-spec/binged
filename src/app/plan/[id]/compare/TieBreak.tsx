"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { organiserChooseAction, tieVoteAction } from "@/app/actions/group";
import { useLiveRefresh } from "@/components/AutoRefresh";

type Option = { id: string; name: string; area: string; yes: string[] };

// No place got a yes from everyone, so the top two go to a short vote (SPEC S12). It closes when everyone has
// voted or the time is up; a tie goes to the organiser.
export function TieBreak({ planId, options, endsAt, voted, voters, myVote, closed, isOrganiser }: {
  planId: string; options: [Option, Option]; endsAt: number; voted: number; voters: number; myVote: string | null; closed: boolean; isOrganiser: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));

  useLiveRefresh(2000); // pick up other people's votes, and the close
  useEffect(() => {
    const tick = setInterval(() => setLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))), 500);
    return () => clearInterval(tick);
  }, [endsAt]);

  const vote = (id: string) => start(async () => { await tieVoteAction(planId, id); router.refresh(); });
  const choose = (id: string) => start(async () => { await organiserChooseAction(planId, id); router.refresh(); });

  if (closed) {
    // The vote tied (or nobody voted): the organiser decides.
    return (
      <section className="space-y-3 rounded-2xl border border-brand bg-brand-soft p-4" aria-live="polite">
        <h2 className="font-bold">It&apos;s a tie: {isOrganiser ? "you decide" : "the organiser decides"}</h2>
        {isOrganiser ? (
          <div className="grid gap-2">
            {options.map((o) => (
              <button key={o.id} disabled={pending} onClick={() => choose(o.id)} className="rounded-xl bg-brand py-3 font-semibold text-brand-ink disabled:opacity-60">Go with {o.name}</button>
            ))}
          </div>
        ) : (
          <p className="text-sm">Waiting for the organiser to choose between {options[0].name} and {options[1].name}.</p>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl border border-brand bg-brand-soft p-4" aria-live="polite" data-testid="tiebreak">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Nobody said yes to everything. Final vote</h2>
        <span className="rounded-full bg-surface px-2.5 py-1 text-sm font-semibold tabular-nums" aria-label={`${left} seconds left`}>{left}s</span>
      </div>
      <p className="text-sm">The two most popular places. Pick one: {voted} of {voters} have voted.</p>
      <div className="grid gap-2">
        {options.map((o) => (
          <button
            key={o.id} disabled={pending} onClick={() => vote(o.id)} aria-pressed={myVote === o.id}
            className={`rounded-xl border px-3.5 py-3 text-left ${myVote === o.id ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface"}`}
          >
            <span className="block font-semibold">{o.name}{myVote === o.id && " ✓"}</span>
            <span className={`block text-sm ${myVote === o.id ? "" : "text-muted"}`}>{o.area} · {o.yes.length} said yes</span>
          </button>
        ))}
      </div>
    </section>
  );
}
