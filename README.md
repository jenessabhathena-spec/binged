# Binged

Agree on one restaurant in Bengaluru, fast. The organiser creates a plan and shares it on WhatsApp; everyone
adds their start area, private budget and tastes, swipes right or left on 10+ places, and Binged picks the place
that's fairest for the whole group. Full spec: [SPEC.md](SPEC.md).

## Status

| Milestone | State |
|---|---|
| **M0** Project setup | Done: Next.js 16 + TypeScript + Tailwind 4, Supabase clients, `config.ts`, `.env.example`, one page per step with a progress bar, lint + typecheck + build pass. Vercel preview not set up yet (needs your Vercel account). |
| M1-M10 | Not started. Each page shows what it will do and which milestone builds it. |

Product decisions on top of the spec are recorded at the top of SPEC.md (everyone swipes 10+; mocks until keys
exist; area + pin, never a street address).

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm run check    # lint + typecheck
npm run build
```

With `.env.local` empty, Binged runs in **mock mode**: a seed list of real Bengaluru restaurant names
(`src/lib/places/seed.ts`) with no invented prices, ratings or hours, and a stand-in for sign-in. Copy
`.env.example` to `.env.local` and add Supabase and Google keys to switch to real data.

## The flow (one page per step)

Organiser: `/` sign in → `/profile` → `/preferences` → `/home` → `/plan/new` → `/plan/[id]/share` →
`/plan/[id]/lobby` → `/plan/[id]/swipe` → `/plan/[id]/results` → `/plan/[id]/winner` → `/plan/[id]/rate`

Friend: `/j/[code]` → lobby → swipe → results → winner → rate. Solo: `/solo`. Policy: `/privacy`.

All tunable numbers (deck size, radius, weights, ₹ per price level, limits) are in `src/config.ts`.
