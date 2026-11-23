import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy" };

// Placeholder until M10 (SPEC §10): the full policy needs legal review before launch.
export default function Privacy() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <Link href="/" className="text-xl font-extrabold tracking-tight text-brand">binged</Link>
      <h1 className="mt-6 text-2xl font-bold">Privacy</h1>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-muted">
        <li>We store your name and email from Google, your home and work area (never a street address) and your preferences.</li>
        <li>Your budget is private: it is never shown to or sent to anyone else.</li>
        <li>Plan answers are deleted 90 days after the plan. You can ask us to delete your data at any time.</li>
      </ul>
      <p className="mt-6 text-xs text-muted">Draft for M0. The full policy is written and legally reviewed in M10.</p>
    </main>
  );
}
