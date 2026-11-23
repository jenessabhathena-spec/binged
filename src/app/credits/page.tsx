import type { Metadata } from "next";
import Link from "next/link";
import credits from "../../../public/images/food/credits.json";

export const metadata: Metadata = { title: "Photo credits" };

type Credit = { title: string; author: string; license: string; licenseUrl: string; source: string };

export default function Credits() {
  const rows = Object.entries(credits as Record<string, Credit>);
  return (
    <main className="mx-auto w-full max-w-md px-4 pb-10 pt-6">
      <Link href="/" className="text-xl font-extrabold tracking-tight text-brand">binged</Link>
      <h1 className="mt-6 text-2xl font-bold">Photo credits</h1>
      <p className="mt-1.5 text-muted">Until Google Places is connected, restaurant cards show an openly licensed photo of the kind of food they serve. It is not a photo of the restaurant itself. Photos are from Wikimedia Commons.</p>
      <ul className="mt-5 space-y-3 text-sm">
        {rows.map(([key, c]) => (
          <li key={key} className="rounded-2xl border border-line bg-surface p-3.5">
            <p className="font-medium">{c.title}</p>
            <p className="text-muted">By {c.author}. <a className="underline" href={c.licenseUrl || c.source} target="_blank" rel="noopener noreferrer">{c.license}</a> · <a className="underline" href={c.source} target="_blank" rel="noopener noreferrer">Source</a></p>
          </li>
        ))}
      </ul>
    </main>
  );
}
