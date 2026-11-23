import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { DemoSignInForm } from "./DemoSignInForm";

export const metadata: Metadata = { title: "Sign in" };

// Stand-in for Google's account screen until a Supabase project with Google sign-in exists.
export default function DemoSignIn({ searchParams }: PageProps<"/auth/demo">) {
  if (isSupabaseConfigured()) notFound();
  return (
    <main className="mx-auto w-full max-w-md px-4 pb-10 pt-6">
      <Link href="/" className="text-xl font-extrabold tracking-tight text-brand">binged</Link>
      <h1 className="mt-6 text-2xl font-bold">Continue with Google</h1>
      <p className="mt-1.5 text-muted">Google sign-in isn&apos;t connected yet, so this demo asks for the two things Google would share with Binged: your name and email.</p>
      <Suspense fallback={<div className="mt-6 h-48" aria-hidden />}>
        <Form searchParams={searchParams} />
      </Suspense>
      <p className="mt-6 rounded-xl border border-dashed border-line px-3 py-2 text-xs text-muted">
        Demo mode. Once the Supabase project is set up, this page disappears and the button opens Google&apos;s real account chooser.
      </p>
    </main>
  );
}

async function Form({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).next;
  const next = typeof raw === "string" ? raw : "/profile"; // the action re-checks this before using it
  return <DemoSignInForm next={next} />;
}
