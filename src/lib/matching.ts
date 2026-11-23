// Group matching (SPEC §7.3): from everyone's swipes to a shortlist and one winner. Pure and deterministic:
// the same swipes always give the same answer, whatever order they arrived in.

import { config } from "@/config";
import type { PoolEntry } from "@/lib/pool";

export type Swipe = { memberId: string; placeId: string; liked: boolean };

export type Ranked = {
  entry: PoolEntry;
  yes: string[]; // member ids who said yes
  yesCount: number;
  full: boolean; // every member who swiped said yes
};

// Order: fairest first (shortest longest-trip), then smaller gap between trips, then higher rating, then name.
const byFairness = (a: PoolEntry, b: PoolEntry) =>
  a.maxTravel - b.maxTravel || a.spread - b.spread || (b.place.rating ?? 0) - (a.place.rating ?? 0) || a.place.name.localeCompare(b.place.name);

export type Ranking = {
  participants: string[]; // members who swiped at least once
  ordered: Ranked[]; // full matches first (by fairness), then the rest by yes-count then fairness
  fullMatches: Ranked[];
  shortlist: Ranked[]; // up to shortlistMax places someone said yes to
};

export function rank(deck: PoolEntry[], swipes: Swipe[]): Ranking {
  const deckIds = new Set(deck.map((e) => e.place.id));
  const mine = swipes.filter((s) => deckIds.has(s.placeId));
  const participants = [...new Set(mine.map((s) => s.memberId))].sort();
  const ranked: Ranked[] = deck.map((entry) => {
    const yes = participants.filter((m) => mine.some((s) => s.memberId === m && s.placeId === entry.place.id && s.liked)).sort();
    return { entry, yes, yesCount: yes.length, full: participants.length > 0 && yes.length === participants.length };
  });
  const fullMatches = ranked.filter((r) => r.full).sort((a, b) => byFairness(a.entry, b.entry));
  const others = ranked.filter((r) => !r.full).sort((a, b) => b.yesCount - a.yesCount || byFairness(a.entry, b.entry));
  const ordered = [...fullMatches, ...others];
  const shortlist = ordered.filter((r) => r.yesCount > 0).slice(0, config.voting.shortlistMax);
  return { participants, ordered, fullMatches, shortlist };
}

export type TieBreak = {
  optionIds: [string, string];
  votes: Record<string, string>; // memberId -> placeId
  closed: boolean; // 60 seconds are up, or everyone has voted
  organiserChoice?: string;
};

export type Outcome =
  | { kind: "winner"; winner: Ranked; runnerUps: Ranked[]; via: "full_match" | "only_option" | "tiebreak" | "organiser" }
  | { kind: "tiebreak"; options: [Ranked, Ranked] } // a vote between the top two is needed (or still open)
  | { kind: "organiser_decides"; options: [Ranked, Ranked] } // the vote tied: the organiser picks
  | { kind: "no_match" }; // nobody said yes to anything

export function decide(ranking: Ranking, tie?: TieBreak): Outcome {
  const { ordered, fullMatches } = ranking;
  const runnersAfter = (w: Ranked) => ordered.filter((r) => r.entry.place.id !== w.entry.place.id && r.yesCount > 0).slice(0, 2);

  if (fullMatches.length) return { kind: "winner", winner: fullMatches[0], runnerUps: runnersAfter(fullMatches[0]), via: "full_match" };

  const withYes = ordered.filter((r) => r.yesCount > 0);
  if (withYes.length === 0) return { kind: "no_match" };
  if (withYes.length === 1) return { kind: "winner", winner: withYes[0], runnerUps: [], via: "only_option" };

  const options: [Ranked, Ranked] = [withYes[0], withYes[1]];
  if (!tie || tie.optionIds[0] !== options[0].entry.place.id || tie.optionIds[1] !== options[1].entry.place.id) return { kind: "tiebreak", options };
  if (!tie.closed) return { kind: "tiebreak", options };

  const tally = (id: string) => Object.values(tie.votes).filter((v) => v === id).length;
  const [a, b] = options, ta = tally(a.entry.place.id), tb = tally(b.entry.place.id);
  if (ta !== tb) {
    const w = ta > tb ? a : b;
    return { kind: "winner", winner: w, runnerUps: runnersAfter(w), via: "tiebreak" };
  }
  const chosen = options.find((o) => o.entry.place.id === tie.organiserChoice);
  if (chosen) return { kind: "winner", winner: chosen, runnerUps: runnersAfter(chosen), via: "organiser" };
  return { kind: "organiser_decides", options };
}
