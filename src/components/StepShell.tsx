import Link from "next/link";
import type { ReactNode } from "react";
import { STEPS, position, FRIEND_FLOW, ORGANISER_FLOW, type StepKey } from "@/lib/steps";

type Props = {
  step: StepKey;
  flow?: "organiser" | "friend" | "none";
  title?: string;
  subtitle?: string;
  back?: string;
  next?: { href: string; label: string };
  secondary?: { href: string; label: string };
  children?: ReactNode;
};

// One screen of the flow: header, progress, content, and a sticky action bar. Mobile-first (360 px up).
export function StepShell({ step, flow = "organiser", title, subtitle, back, next, secondary, children }: Props) {
  const s = STEPS[step];
  const pos = flow === "none" ? null : position(step, flow === "friend" ? FRIEND_FLOW : ORGANISER_FLOW);
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-28 pt-4">
      <header className="flex items-center gap-3">
        {back ? (
          <Link href={back} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-lg">
            ←
          </Link>
        ) : (
          <span className="h-9 w-9" />
        )}
        <Link href="/" className="text-xl font-extrabold tracking-tight text-brand">binged</Link>
        <span className="ml-auto rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">{s.who}</span>
      </header>

      {pos && (
        <div className="mt-4" aria-label={`Step ${pos.number} of ${pos.total}`}>
          <div className="flex justify-between text-xs text-muted">
            <span>Step {pos.number} of {pos.total}</span>
            <span>{s.spec}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pos.percent}%` }} />
          </div>
        </div>
      )}

      <main className="mt-6 flex-1">
        <h1 className="text-2xl font-bold leading-tight">{title ?? s.title}</h1>
        {subtitle && <p className="mt-1.5 text-muted">{subtitle}</p>}
        <div className="mt-5 space-y-3">{children}</div>
        <p className="mt-6 rounded-xl border border-dashed border-line px-3 py-2 text-xs text-muted">
          Preview (M0): this page is a placeholder for navigation. It is built in milestone {s.milestone}.
        </p>
      </main>

      {(next || secondary) && (
        <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-md flex-col gap-2 px-4 py-3">
            {next && (
              <Link href={next.href} className="block rounded-2xl bg-brand py-3.5 text-center font-semibold text-brand-ink">
                {next.label}
              </Link>
            )}
            {secondary && (
              <Link href={secondary.href} className="block rounded-2xl border border-line bg-surface py-3 text-center font-medium">
                {secondary.label}
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}

// A card describing what a screen will contain.
export function Planned({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((t) => (
        <li key={t} className="flex gap-3 rounded-2xl border border-line bg-surface p-3.5">
          <span aria-hidden className="mt-0.5 text-brand">●</span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}
