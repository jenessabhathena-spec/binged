"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SwipeDeck, type DeckHandlers } from "@/app/plan/[id]/swipe/SwipeDeck";
import { CompareTable } from "@/components/CompareTable";
import { ShortlistRow } from "@/components/ShortlistRow";
import { WinnerPanel } from "@/components/WinnerPanel";
import { toCard } from "@/lib/cards";
import { buildDemoPool, DEMO_PEOPLE, DEMO_YOU, friendSwipes, friendTieVotes } from "@/lib/demo";
import { decide, rank, type Ranked, type Swipe, type TieBreak } from "@/lib/matching";
import { istToEpoch, nextFridayIST } from "@/lib/plans";

type Phase = "intro" | "swipe" | "shortlist" | "compare" | "winner";
const STEPS: { key: Phase; label: string }[] = [
  { key: "intro", label: "Meet the group" }, { key: "swipe", label: "Swipe" }, { key: "shortlist", label: "Shortlist" },
  { key: "compare", label: "Compare" }, { key: "winner", label: "Winner" },
];
const PEOPLE = DEMO_PEOPLE.map((p) => ({ id: p.id, firstName: p.firstName }));

const primary = "block w-full rounded-2xl bg-brand py-3.5 text-center font-semibold text-brand-ink";
const secondary = "block w-full rounded-2xl border border-line bg-surface py-3 text-center font-medium";

// A guided tour of Binged for one person: you are Asha, Ravi and Meera are pretend friends who swipe on their own.
// It runs entirely in the browser, with no sign-in and nothing saved.
export function DemoApp() {
  const pool = useMemo(() => buildDemoPool(), []);
  const deck = pool.deck;
  const [phase, setPhase] = useState<Phase>("intro");
  const [mine, setMine] = useState<Swipe[]>([]); // your swipes, in order
  const [round, setRound] = useState(0); // changes to deal a fresh deck
  const [startsAt, setStartsAt] = useState(0);
  const [tieChoice, setTieChoice] = useState<string | null>(null);

  const ranking = useMemo(() => rank(deck, [...mine, ...friendSwipes(deck)]), [deck, mine]);
  const outcome = useMemo(() => {
    const first = decide(ranking);
    if (first.kind !== "tiebreak" || !tieChoice) return first;
    const optionIds: [string, string] = [first.options[0].entry.place.id, first.options[1].entry.place.id];
    const tie: TieBreak = { optionIds, votes: { ...friendTieVotes(optionIds), [DEMO_YOU]: tieChoice }, closed: true };
    return decide(ranking, tie);
  }, [ranking, tieChoice]);

  const yesNames = (r: Ranked) => PEOPLE.filter((p) => r.yes.includes(p.id)).map((p) => p.firstName);
  const stepIndex = STEPS.findIndex((s) => s.key === phase);

  const handlers: DeckHandlers = {
    swipe: async (placeId, liked) => { setMine((m) => [...m.filter((x) => x.placeId !== placeId), { memberId: DEMO_YOU, placeId, liked }]); return { ok: true }; },
    undo: async () => { setMine((m) => m.slice(0, -1)); return { ok: true }; },
    done: () => setPhase("shortlist"),
  };

  const start = () => { setStartsAt(istToEpoch(nextFridayIST(Date.now()), "20:00")); setPhase("swipe"); };
  const again = () => { setMine([]); setTieChoice(null); setRound((r) => r + 1); setPhase("intro"); };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-32 pt-4">
      <header className="flex items-center gap-3">
        <Link href="/" className="text-xl font-extrabold tracking-tight text-brand">binged</Link>
        <span className="ml-auto rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">Demo</span>
      </header>

      <div className="mt-4" aria-label={`Step ${stepIndex + 1} of ${STEPS.length}`}>
        <div className="flex justify-between text-xs text-muted"><span>Step {stepIndex + 1} of {STEPS.length}</span><span>{STEPS[stepIndex].label}</span></div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} /></div>
      </div>

      <main className="mt-6 flex-1 space-y-3">
        {phase === "intro" && (
          <>
            <h1 className="text-2xl font-bold leading-tight">Friday dinner for three</h1>
            <p className="text-muted">A quick tour. You are Asha. Ravi and Meera are pretend friends who swipe on their own, so you can see the whole thing alone.</p>
            <ul className="space-y-2" data-testid="demo-people">
              {PEOPLE.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
                  <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft font-bold text-brand">{p.firstName[0]}</span>
                  <span className="flex-1 font-medium">{p.firstName}{p.id === DEMO_YOU && <span className="text-muted"> (you)</span>}</span>
                  <span className="text-sm text-ok">Answered ✓</span>
                </li>
              ))}
            </ul>
            <p className="rounded-2xl bg-brand-soft px-3.5 py-3 text-sm"><span className="font-semibold">One meeting area for everyone: {pool.centerName}.</span> It&apos;s the middle of everyone&apos;s starting points. Nobody&apos;s budget or start area is shown to anyone.</p>
            <ul className="space-y-2 text-sm text-muted">
              <li>Next: swipe {deck.length} real Bengaluru restaurants. Right is yes, left is no.</li>
              <li>Then: the group&apos;s shortlist, a side-by-side comparison, and one winner.</li>
              <li>Finally: book, call, get directions, or share it on WhatsApp.</li>
            </ul>
          </>
        )}

        {phase === "swipe" && (
          <>
            <h1 className="text-2xl font-bold leading-tight">Swipe {deck.length} places</h1>
            <p className="text-muted">Everyone swipes the same places, near {pool.centerName}. Right for yes, left for no. Ravi and Meera are swiping too.</p>
            <SwipeDeck key={round} planId="demo" handlers={handlers} cards={deck.map((e) => toCard(e, PEOPLE))} alreadyDone={0} total={deck.length} />
          </>
        )}

        {phase === "shortlist" && (ranking.shortlist.length === 0 ? (
          <>
            <h1 className="text-2xl font-bold leading-tight">No shortlist this time</h1>
            <p className="text-muted">Nobody said yes to any of the places. Try again and say yes to a few.</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold leading-tight">{ranking.shortlist.length} places made your shortlist</h1>
            <p className="text-muted">{ranking.fullMatches.length ? `${ranking.fullMatches.length === 1 ? "1 place" : `${ranking.fullMatches.length} places`} everyone said yes to, fairest first.` : "Nobody agreed on a single place, so these are the most popular."}</p>
            <ol className="space-y-3" data-testid="shortlist">
              {ranking.shortlist.map((r, i) => <ShortlistRow key={r.entry.place.id} r={r} rank={i + 1} swiped={ranking.participants.length} yesNames={yesNames(r)} />)}
            </ol>
          </>
        ))}

        {phase === "compare" && (
          <>
            <h1 className="text-2xl font-bold leading-tight">Compare your shortlist</h1>
            <p className="text-muted">Side by side. The best value in each row is marked.</p>
            <CompareTable cols={ranking.shortlist} voters={PEOPLE} participants={ranking.participants.length} />
            {outcome.kind === "tiebreak" && (
              <section className="space-y-3 rounded-2xl border border-brand bg-brand-soft p-4" data-testid="tiebreak">
                <h2 className="font-bold">Nobody said yes to everything. Final vote</h2>
                <p className="text-sm">The two most popular places. Ravi and Meera are split, so your vote decides.</p>
                <div className="grid gap-2">
                  {outcome.options.map((o) => (
                    <button key={o.entry.place.id} onClick={() => setTieChoice(o.entry.place.id)} className="rounded-xl border border-line bg-surface px-3.5 py-3 text-left">
                      <span className="block font-semibold">{o.entry.place.name}</span>
                      <span className="block text-sm text-muted">{o.entry.place.area} · {o.yesCount} said yes</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
            {outcome.kind === "winner" && (
              <p className="rounded-2xl bg-brand-soft px-3.5 py-3 text-sm">
                {outcome.via === "full_match" ? "Everyone said yes to at least one place, so the fairest of those wins." : outcome.via === "tiebreak" ? "The final vote is in." : "Only one place got a yes."}
              </p>
            )}
          </>
        )}

        {phase === "winner" && outcome.kind === "winner" && (
          <>
            <h1 className="text-2xl font-bold leading-tight">You&apos;re going to {outcome.winner.entry.place.name}</h1>
            <p className="text-muted">Friday, 8:00 pm · 3 people · {outcome.winner.entry.place.area}</p>
            <WinnerPanel outcome={outcome} voters={PEOPLE} yesNames={yesNames(outcome.winner)} participants={ranking.participants.length} plan={{ startsAt, partySize: PEOPLE.length }} />
            <div className="space-y-2 pt-2">
              <button onClick={again} className={secondary}>Play the demo again</button>
              <Link href="/" className={primary}>Make a real plan with friends</Link>
            </div>
          </>
        )}

        <p className="pt-2 text-xs text-muted">Demo only: Ravi and Meera are made up and nothing is saved. Restaurant names are real. Prices, ratings and phone numbers aren&apos;t known yet; they come from Google once it&apos;s connected.</p>
      </main>

      {phase !== "swipe" && phase !== "winner" && (
        <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-md flex-col gap-2 px-4 py-3">
            {phase === "intro" && <button onClick={start} className={primary}>Start picking</button>}
            {phase === "shortlist" && (ranking.shortlist.length === 0
              ? <button onClick={() => { setMine([]); setRound((r) => r + 1); setPhase("swipe"); }} className={primary}>Swipe again</button>
              : <button onClick={() => setPhase("compare")} className={primary}>Compare them</button>)}
            {phase === "compare" && (outcome.kind === "winner"
              ? <button onClick={() => setPhase("winner")} className={primary}>Reveal the winner</button>
              : <p className="text-center text-sm text-muted">Pick one of the two above to see the winner.</p>)}
            {phase === "compare" && <button onClick={() => setPhase("shortlist")} className={secondary}>Back to the shortlist</button>}
          </div>
        </nav>
      )}
    </div>
  );
}
