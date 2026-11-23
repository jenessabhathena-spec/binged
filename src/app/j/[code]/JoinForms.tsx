"use client";
import { useActionState } from "react";
import { joinAsGuestAction, joinSignedInAction, type JoinState } from "@/app/actions/group";
import { GoogleButton } from "@/components/GoogleButton";
import { config } from "@/config";

const primary = "w-full rounded-2xl bg-brand py-3.5 font-semibold text-brand-ink disabled:opacity-60";

// Two ways in (SPEC S7): Google (remembered next time) or just a first name (no account).
export function JoinChoices({ code }: { code: string }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(joinAsGuestAction, {});
  return (
    <div className="space-y-4">
      <GoogleButton next={`/j/${code}`} />
      <div className="flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      <form action={action} className="space-y-3">
        <input type="hidden" name="code" value={code} />
        <label className="block">
          <span className="text-sm font-semibold">Just my first name</span>
          <input
            name="firstName" required maxLength={config.members.firstNameMax} autoComplete="given-name" defaultValue={state.name}
            aria-invalid={!!state.error} placeholder="Your first name" className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-3"
          />
        </label>
        {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
        <button disabled={pending} className={primary}>{pending ? "Joining…" : "Join the plan"}</button>
        <p className="text-xs text-muted">No account, no app. We keep your answers only until the plan is done.</p>
      </form>
    </div>
  );
}

export function JoinSignedIn({ code, name }: { code: string; name: string }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(joinSignedInAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="code" value={code} />
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className={primary}>{pending ? "Joining…" : `Join as ${name}`}</button>
    </form>
  );
}
