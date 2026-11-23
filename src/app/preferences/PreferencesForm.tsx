"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { savePreferencesAction, type PreferencesState } from "@/app/actions/preferences";
import { Chip, Section } from "@/components/Chip";
import { config } from "@/config";
import { CUISINES, DEALBREAKERS, DIETS, inr, SPICES, TRAVEL_MINUTES, VIBES, type Preferences } from "@/lib/preferences";

export function PreferencesForm({ prefs }: { prefs: Preferences }) {
  const [state, action, pending] = useActionState<PreferencesState, FormData>(savePreferencesAction, {});
  const e = state.errors ?? {};
  const { min, max, step } = config.budget;
  // The budget starts "not set" until the person chooses one; "I'd rather not say" turns it back off.
  const [skipBudget, setSkipBudget] = useState(prefs.budgetPerPerson === null);
  const [budget, setBudget] = useState(prefs.budgetPerPerson ?? config.budget.default);

  return (
    <form action={action} className="space-y-7">
      <Section title="Cuisines you like" error={e.cuisines}>
        {CUISINES.map((c) => <Chip key={c} type="checkbox" name="cuisines" value={c} label={c} defaultChecked={prefs.cuisines.includes(c)} />)}
      </Section>

      <Section title="Diet" error={e.diet}>
        <Chip type="radio" name="diet" value="" label="No preference" defaultChecked={prefs.diet === null} />
        {DIETS.map((d) => <Chip key={d} type="radio" name="diet" value={d} label={d} defaultChecked={prefs.diet === d} />)}
      </Section>

      <Section title="Spice" error={e.spice}>
        <Chip type="radio" name="spice" value="" label="No preference" defaultChecked={prefs.spice === null} />
        {SPICES.map((s) => <Chip key={s} type="radio" name="spice" value={s} label={s} defaultChecked={prefs.spice === s} />)}
      </Section>

      <fieldset className="space-y-2.5">
        <legend className="text-sm font-semibold">Usual budget per person <span className="font-normal text-muted">(optional)</span></legend>
        <p className="flex items-center gap-1.5 text-sm text-muted"><span aria-hidden>🔒</span> Private: only you can see this. Not your friends, not the plan organiser.</p>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-center text-2xl font-bold" aria-live="polite">{skipBudget ? "Not set" : inr(budget)}</p>
          <input
            type="range" name="budget" min={min} max={max} step={step} value={budget} disabled={skipBudget}
            onChange={(ev) => setBudget(Number(ev.target.value))} aria-label="Usual budget per person in rupees"
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

      <Section title="Vibe" error={e.vibes}>
        {VIBES.map((v) => <Chip key={v} type="checkbox" name="vibes" value={v} label={v} defaultChecked={prefs.vibes.includes(v)} />)}
      </Section>

      <Section title="Dealbreakers" hint="Places that break any of these are never shown to your group." error={e.dealbreakers}>
        {DEALBREAKERS.map((d) => <Chip key={d.key} type="checkbox" name="dealbreakers" value={d.key} label={d.label} defaultChecked={prefs.dealbreakers.includes(d.key)} />)}
      </Section>

      <label className="block space-y-2">
        <span className="text-sm font-semibold">Longest trip you&apos;ll make <span className="font-normal text-muted">(default 40 min)</span></span>
        <select name="maxTravelMin" defaultValue={prefs.maxTravelMin} className="w-full rounded-xl border border-line bg-surface px-3.5 py-3">
          {TRAVEL_MINUTES.map((m) => <option key={m} value={m}>{m} minutes</option>)}
        </select>
        {e.maxTravelMin && <span role="alert" className="block text-sm text-red-600">{e.maxTravelMin}</span>}
      </label>

      {state.formError && <p role="alert" className="text-sm text-red-600">{state.formError}</p>}

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-md flex-col gap-2 px-4 py-3">
          <button disabled={pending} className="w-full rounded-2xl bg-brand py-3.5 font-semibold text-brand-ink disabled:opacity-60">
            {pending ? "Saving…" : "Save and continue"}
          </button>
          <Link href="/home" className="block rounded-2xl border border-line bg-surface py-3 text-center font-medium">Skip for now</Link>
        </div>
      </div>
    </form>
  );
}
