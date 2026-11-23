import Link from "next/link";

// One message for every bad link (wrong code, expired, closed) so the page says nothing about which it was.
export default function InviteNotFound() {
  return (
    <main className="mx-auto w-full max-w-md px-4 pt-8">
      <Link href="/" className="text-xl font-extrabold tracking-tight text-brand">binged</Link>
      <h1 className="mt-8 text-2xl font-bold">This invite isn&apos;t available</h1>
      <p className="mt-2 text-muted">The link may be mistyped, or the plan has already happened. Ask whoever invited you to send a fresh link.</p>
    </main>
  );
}
