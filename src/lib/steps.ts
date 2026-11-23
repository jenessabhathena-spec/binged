// The flow, one page per step (SPEC §4-§5). Drives the progress bar and Back/Next on every screen.

export type StepKey =
  | "signin" | "profile" | "preferences" | "home" | "new-plan" | "share" | "lobby" | "swipe" | "results" | "winner" | "rate"
  | "join" | "me" | "compare" | "solo";

export type Step = { key: StepKey; title: string; spec: string; milestone: string; who: string };

export const STEPS: Record<StepKey, Step> = {
  signin: { key: "signin", title: "Welcome", spec: "S1", milestone: "M1", who: "Everyone" },
  profile: { key: "profile", title: "Your profile", spec: "S2", milestone: "M1", who: "Everyone" },
  preferences: { key: "preferences", title: "Your tastes", spec: "S3", milestone: "M2", who: "Everyone" },
  home: { key: "home", title: "Home", spec: "S4", milestone: "M3", who: "Organiser" },
  "new-plan": { key: "new-plan", title: "Create a plan", spec: "S5", milestone: "M3", who: "Organiser" },
  share: { key: "share", title: "Invite friends", spec: "S6", milestone: "M3", who: "Organiser" },
  join: { key: "join", title: "Join the plan", spec: "S7", milestone: "M4", who: "Friend" },
  me: { key: "me", title: "Your answers", spec: "S7", milestone: "M4", who: "Friend" },
  lobby: { key: "lobby", title: "Who's in", spec: "S8", milestone: "M4", who: "Everyone" },
  swipe: { key: "swipe", title: "Swipe", spec: "S10-S11", milestone: "M6-M7", who: "Everyone" },
  results: { key: "results", title: "Your shortlist", spec: "S12", milestone: "M7", who: "Everyone" },
  compare: { key: "compare", title: "Compare", spec: "S12", milestone: "M7", who: "Everyone" },
  winner: { key: "winner", title: "Let's go", spec: "S13", milestone: "M8", who: "Everyone" },
  rate: { key: "rate", title: "How was it?", spec: "S14", milestone: "M9", who: "Everyone" },
  solo: { key: "solo", title: "Find something for me", spec: "Solo", milestone: "M9", who: "Just you" },
};

// The organiser's journey, in order. Friends join at "join" and continue from "lobby".
export const ORGANISER_FLOW: StepKey[] = ["signin", "profile", "preferences", "home", "new-plan", "share", "lobby", "swipe", "results", "compare", "winner", "rate"];
export const FRIEND_FLOW: StepKey[] = ["join", "me", "lobby", "swipe", "results", "compare", "winner", "rate"];

export function position(key: StepKey, flow: StepKey[] = key === "join" ? FRIEND_FLOW : ORGANISER_FLOW) {
  const i = flow.indexOf(key);
  return { index: i, number: i + 1, total: flow.length, percent: Math.round(((i + 1) / flow.length) * 100) };
}
