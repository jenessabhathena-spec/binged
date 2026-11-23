"use client";
import { useActionState, useState } from "react";
import { saveAnswersAction, type AnswersState } from "@/app/actions/group";
import { AreaPicker } from "@/components/AreaPicker";
import { Chip, Section } from "@/components/Chip";
import { config } from "@/config";
import { CUISINES, DEALBREAKERS, inr, TRAVEL_MINUTES, VIBES, type Preferences } from "@/lib/preferences";
import type { AreaPin } from "@/lib/profile";

// The 30-second form (SPEC S7). Only the starting area is required. Budget is private: only this person sees it.
export function AnswersForm({ planId, start, prefs, editing }: { planId: string; start: AreaPin | null; prefs: Preferences; editing: boolean }) {
  const [state, action, pending] = useActionState<AnswersState, FormData>(saveAnswersAction.bind(null, planId), {});
  const e = state.errors ?? {};
  const { min, max, step } = config.budget;
  const [skipBudget, setSkipBudget] = useState(prefs.budgetPerPerson === null);
  const [budget, setBudget] = useState(prefs.budgetPerPerson ?? config.budget.default);

  return (
    <form action={action} className="space-y-7">
      <AreaPicker
        name="start" label="Where will you start from?" required value={start} error={e.start}
        hint="An area or a map pin is enough. Never a street address."
      />

      <fieldset className="space-y-2.5">
        <legend className="text-sm font-semibold">Budget per person <span className="font-normal text-muted">(optional)</span></legend>
        <p className="flex items-center gap-1.5 text-sm text-muted"><span aria-hidden>🔒</span> Private: only you can see this. We only use the lowest budget in the group to pick places, and never show anyone&apos;s number.</p>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-center text-2xl font-bold" aria-live="polite">{skipBudget ? "Not set" : inr(budget)}</p>
          <input
            type="range" name="budget" min={min} max={max} step={step} value={budget} disabled={skipBudget}
            onChange={(ev) => setBudget(Number(ev.target.value))} aria-label="Budget per person in rupees"
            aria-valuetext={skipBudget ? "Not set" : inr(budget)} className="mt-3 w-full accent-[var(--brand)] disabled:opacity-40"
          />
          <div className="flex justify-between text-xs text-muted"><span>{inr(min)}</span><span>{inr(max)}</span></div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" name="budgetSkip" checked={skipBudget} onChange={(ev) => setSkipBudget(ev.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
            I&apos;d rather not say
          </label>
        </div>
        {e.budgetPerPerson && <p role="alert" className="text-sm text-red-600">{e.budgetPerPerson}</p>}
      </fieldset>

      <Section title="Dealbreakers" hint="Places that break any of these are never shown to the group." error={e.dealbreakers}>
        {DEALBREAKERS.map((d) => <Chip key={d.key} type="checkbox" name="dealbreakers" value={d.key} label={d.label} defaultChecked={prefs.dealbreakers.includes(d.key)} />)}
      </Section>

      <Section title="Mood" error={e.vibes}>
        {VIBES.map((v) => <Chip key={v} type="checkbox" name="vibes" value={v} label={v} defaultChecked={prefs.vibes.includes(v)} />)}
      </Section>

      <Section title="Cuisines you like" error={e.cuisines}>
        {CUISINES.map((c) => <Chip key={c} type="checkbox" name="cuisines" value={c} label={c} defaultChecked={prefs.cuisines.includes(c)} />)}
      </Section>

      <label className="block space-y-2">
        <span className="text-sm font-semibold">Longest trip you&apos;ll make</span>
        <select name="maxTravelMin" defaultValue={prefs.maxTravelMin} className="w-full rounded-xl border border-line bg-surface px-3.5 py-3">
          {TRAVEL_MINUTES.map((m) => <option key={m} value={m}>{m} minutes</option>)}
        </select>
        {e.maxTravelMin && <span role="alert" className="block text-sm text-red-600">{e.maxTravelMin}</span>}
      </label>

      {state.formError && <p role="alert" className="text-sm text-red-600">{state.formError}</p>}

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-md px-4 py-3">
          <button disabled={pending} className="w-full rounded-2xl bg-brand py-3.5 font-semibold text-brand-ink disabled:opacity-60">
            {pending ? "Saving…" : editing ? "Save my answers" : "I'm in"}
          </button>
        </div>
      </div>
    </form>
  );
}
