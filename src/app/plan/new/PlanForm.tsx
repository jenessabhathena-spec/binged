"use client";
import { useActionState, useState } from "react";
import { createPlanAction, type PlanState } from "@/app/actions/plans";
import { AreaPicker } from "@/components/AreaPicker";
import { config } from "@/config";
import { hoursLabel } from "@/lib/plans";

type Defaults = { name: string; date: string; time: string; partySize: string; deadlineHours: string; minDate: string };

const input = "mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-3";
const Err = ({ m }: { m?: string }) => (m ? <p role="alert" className="mt-1 text-sm text-red-600">{m}</p> : null);

export function PlanForm({ defaults }: { defaults: Defaults }) {
  const [state, action, pending] = useActionState<PlanState, FormData>(createPlanAction, {});
  const e = state.errors ?? {};
  const v = state.values; // sent back after a problem so nothing has to be retyped
  const [mode, setMode] = useState<string>(v?.searchMode === "area" ? "area" : "anywhere_fair");
  const { minPartySize, maxPartySize, deadlineHoursOptions } = config.plan;

  return (
    <form action={action} className="space-y-6">
      <label className="block">
        <span className="text-sm font-semibold">Plan name</span>
        <input name="name" required maxLength={config.plan.nameMaxLength} defaultValue={v?.name ?? defaults.name} aria-invalid={!!e.name} className={input} />
        <Err m={e.name} />
      </label>

      <fieldset>
        <legend className="text-sm font-semibold">When</legend>
        <div className="mt-1 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="sr-only">Date</span>
            <input name="date" type="date" required min={defaults.minDate} defaultValue={v?.date ?? defaults.date} aria-label="Date" className="w-full rounded-xl border border-line bg-surface px-3.5 py-3" />
          </label>
          <label className="block">
            <span className="sr-only">Time</span>
            <input name="time" type="time" required defaultValue={v?.time ?? defaults.time} aria-label="Time" className="w-full rounded-xl border border-line bg-surface px-3.5 py-3" />
          </label>
        </div>
        <p className="mt-1 text-xs text-muted">Bengaluru time.</p>
        <Err m={e.when} />
      </fieldset>

      {/* The choice lives in React state and one hidden field, not in real radio buttons: React resets a form's
          inputs after an action, which would leave the screen saying "area" while the form sent "anywhere". */}
      <div role="radiogroup" aria-label="Where to eat" className="space-y-2.5">
        <p className="text-sm font-semibold">Where to eat</p>
        <input type="hidden" name="searchMode" value={mode} />
        {([
          ["anywhere_fair", "Anywhere fair", "Once your friends say where they're starting from, we look near the spot that's fair for everyone."],
          ["area", "A specific area", "You already know the neighbourhood."],
        ] as const).map(([value, title, hint]) => (
          <button
            key={value} type="button" role="radio" aria-checked={mode === value} onClick={() => setMode(value)}
            className={`flex w-full gap-3 rounded-2xl border p-3.5 text-left ${mode === value ? "border-brand bg-brand-soft" : "border-line bg-surface"}`}
          >
            <span aria-hidden className={`mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${mode === value ? "border-brand" : "border-muted"}`}>
              {mode === value && <span className="h-2 w-2 rounded-full bg-brand" />}
            </span>
            <span><span className="block font-medium">{title}</span><span className="block text-sm text-muted">{hint}</span></span>
          </button>
        ))}
        {mode === "area" && <AreaPicker name="search" label="Area to search" required value={null} error={e.searchArea} />}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-semibold">How many people</span>
          <select name="partySize" defaultValue={v?.partySize ?? defaults.partySize} className={input}>
            {Array.from({ length: maxPartySize - minPartySize + 1 }, (_, i) => minPartySize + i).map((n) => <option key={n} value={n}>{n} people</option>)}
          </select>
          <Err m={e.partySize} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Answers close in</span>
          <select name="deadlineHours" defaultValue={v?.deadlineHours ?? defaults.deadlineHours} className={input}>
            {deadlineHoursOptions.map((h) => <option key={h} value={h}>{hoursLabel(h)}</option>)}
          </select>
          <Err m={e.deadline} />
        </label>
      </div>

      {state.formError && <p role="alert" className="text-sm text-red-600">{state.formError}</p>}

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-md px-4 py-3">
          <button disabled={pending} className="w-full rounded-2xl bg-brand py-3.5 font-semibold text-brand-ink disabled:opacity-60">
            {pending ? "Creating…" : "Create plan"}
          </button>
        </div>
      </div>
    </form>
  );
}
