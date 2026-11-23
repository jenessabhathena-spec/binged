"use client";
import { useActionState } from "react";
import { saveProfileAction, type ProfileState } from "@/app/actions/profile";
import { AreaPicker } from "@/components/AreaPicker";
import type { Profile } from "@/lib/profile";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfileAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-6">
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Google avatar from an arbitrary host
          <img src={profile.avatarUrl} alt="" className="h-11 w-11 rounded-full" />
        ) : (
          <span aria-hidden className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-lg font-bold text-brand">{profile.name.slice(0, 1).toUpperCase() || "?"}</span>
        )}
        <div className="min-w-0">
          <p className="text-xs text-muted">Signed in with Google as</p>
          <p className="truncate font-medium" data-testid="email">{profile.email}</p>
        </div>
      </div>

      <label className="block">
        <span className="text-sm font-semibold">Your name</span>
        <input name="name" autoComplete="name" required defaultValue={profile.name} aria-invalid={!!e.name} className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-3" />
        {e.name && <span role="alert" className="mt-1 block text-sm text-red-600">{e.name}</span>}
      </label>

      <AreaPicker name="home" label="Home area" required value={profile.home} error={e.home}
        hint="The neighbourhood you usually start from. We work out travel times from here. We never ask for your street address." />

      <AreaPicker name="work" label="Work area" value={profile.work} error={e.work} hint="Handy when you're meeting after work." />

      {state.formError && <p role="alert" className="text-sm text-red-600">{state.formError}</p>}

      <p className="text-xs text-muted">
        We only use your area and preferences to find fair places for your group. Read our <a href="/privacy" className="underline">privacy note</a>.
      </p>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-md px-4 py-3">
          <button disabled={pending} className="w-full rounded-2xl bg-brand py-3.5 font-semibold text-brand-ink disabled:opacity-60">
            {pending ? "Saving…" : "Save and continue"}
          </button>
        </div>
      </div>
    </form>
  );
}
