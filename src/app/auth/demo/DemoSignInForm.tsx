"use client";
import { useActionState } from "react";
import { demoSignIn, type DemoSignInState } from "@/app/actions/auth";

export function DemoSignInForm() {
  const [state, action, pending] = useActionState<DemoSignInState, FormData>(demoSignIn, {});
  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block">
        <span className="text-sm font-semibold">Name</span>
        <input name="name" autoComplete="name" required defaultValue={state.name} className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-3" />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">Gmail address</span>
        <input name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={state.email} placeholder="you@gmail.com" className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-3" />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-2xl bg-brand py-3.5 font-semibold text-brand-ink disabled:opacity-60">
        {pending ? "Signing in…" : "Continue"}
      </button>
    </form>
  );
}
