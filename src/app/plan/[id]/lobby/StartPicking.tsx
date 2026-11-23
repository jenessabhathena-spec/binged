"use client";
import { useActionState } from "react";
import { startPickingAction, type StartState } from "@/app/actions/group";

export function StartPicking({ planId, canStart }: { planId: string; canStart: boolean }) {
  const [state, action, pending] = useActionState<StartState, FormData>(startPickingAction.bind(null, planId), {});
  return (
    <form action={action}>
      {state.error && <p role="alert" className="mb-2 rounded-xl bg-brand-soft px-3 py-2 text-sm">{state.error}</p>}
      <button disabled={!canStart || pending} className="block w-full rounded-2xl bg-brand py-3.5 text-center font-semibold text-brand-ink disabled:opacity-50">
        {pending ? "Finding places…" : "Start picking"}
      </button>
      {!canStart && <p className="mt-1.5 text-center text-xs text-muted">Waiting for at least 2 people to answer.</p>}
    </form>
  );
}
