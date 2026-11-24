# Binged

Agree on one restaurant in Bengaluru, fast. The organiser creates a plan and shares it on WhatsApp; everyone
adds their start area, private budget and tastes, swipes right or left on 10+ places, and Binged picks the place
that's fairest for the whole group. Full spec: [SPEC.md](SPEC.md).

## Status

| Milestone | State |
|---|---|
| **M0** Project setup | Done: Next.js 16 + TypeScript + Tailwind 4, Supabase clients, `config.ts`, `.env.example`, one page per step with a progress bar, lint + typecheck + build pass. Vercel preview not set up yet (needs your Vercel account). |
| **M1** Auth + profile | Built and tested in demo mode: Continue with Google (real OAuth path written, untested until Supabase exists), profile with home and work area (search, built-in map, current location), no address field. Needs your Supabase and Google keys to run for real: see "Turning on real sign-in". |
| **M2** Preferences | Built and tested in demo mode: cuisines, diet, spice, budget (private), vibe, dealbreakers and max travel time. Every question is optional, saved, and editable from Home and Profile. Needs `supabase/migrations/0002_preferences.sql` once Supabase exists. |
| **M3** Create plan + WhatsApp share | Built and tested in demo mode: name, date and time (Bengaluru time), a specific area or "anywhere fair", party size 2-8 and an answers deadline. The share page has a green WhatsApp button (`wa.me`), a copy-link button and the message preview. The invite link opens for a signed-out visitor, with a link preview (title, "{name} invited you", picture) and one identical "isn't available" page for wrong, expired or closed links. Home lists your plans. Needs `supabase/migrations/0003_plans.sql` once Supabase exists. |
| **M4** Friend join + lobby | Built and tested in demo mode with three people in three separate browser identities. A friend joins from the invite link with Google or just a first name (no account), fills a 30-second form (starting area or pin, private budget, dealbreakers, mood), and sits in a lobby that updates by itself (polling every 3 s in demo mode). The lobby shows first names and "answered" only, plus one meeting area for everyone. Picking starts when the organiser taps Start (needs 2 answers) or at the answers deadline. Needs `supabase/migrations/0004_members_swipes.sql`; the "member A can't read member B's budget" rule is written as row-level security there but **not yet run against a real database**. |
| **M5** Candidate pool | Built and unit-tested (`src/lib/pool.ts`): meeting point, shared budget ceiling (never shown), dealbreakers, each person's travel limit, scoring on taste / fairness / vibe / quality / novelty, a deck of 10 with at most 3 of one cuisine, and a reserve. Runs on the built-in sample list of 37 real Bengaluru restaurants with estimated travel times. Google Places and Routes are not wired yet (need the key). |
| **M6** Swipe | Everyone swipes the same deck of 10 (drag, buttons or arrow keys, with undo; each swipe is saved at once). **Not built: replacing a card after a left swipe** (it would give each person a different deck; see the note below). |
| **M7** Shortlist, compare, winner | Built and tested: shortlist ranked by who said yes, a side-by-side compare table, one winner by the spec's rules (full matches, fairest first; otherwise a 60-second vote between the top two; a tie goes to the organiser). Deterministic and unit-tested. |
| **M8** Winner actions | Book (Google Maps), website, call, directions and WhatsApp share are built as links per the spec's `BookingProvider` design. Opened and checked as links in a desktop browser; **not tried on a real Android or iOS phone**. Call only appears when a phone number is known. |
| M9-M10 | Not started (solo mode, next-day rating, analytics, polish). |

**What the sample data does and doesn't know.** Restaurant names and areas are real. Price, rating, opening hours, phone number, street address and photos are not known until Google Places is connected, so cards say "not confirmed yet" instead of showing a made-up number, and filters that need those facts (budget, open now, parking) let a place through and flag it. Photos are openly licensed pictures of the kind of food, not of the restaurant (credits at `/credits`).

Product decisions on top of the spec are recorded at the top of SPEC.md (everyone swipes 10+; mocks until keys
exist; area + pin, never a street address).

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit tests (Vitest)
npm run check    # lint + typecheck + tests
npm run build
```

With `.env.local` empty, Binged runs in **mock mode**: a seed list of real Bengaluru restaurant names
(`src/lib/places/seed.ts`) with no invented prices, ratings or hours, and a stand-in for sign-in. Copy
`.env.example` to `.env.local` and add Supabase and Google keys to switch to real data.

## Turning on real sign-in (M1)

**The short version is in [SETUP.md](SETUP.md)** (accounts, clicks and the three values for Vercel, in order). `supabase/setup.sql` is all four migrations in one paste. The detail below is for reference.

1. Create a Supabase project. In the SQL editor run, in order, `supabase/migrations/0001_users.sql` (the users table, its Row Level Security and the trigger that copies your Google name, email and photo on first sign-in) `0002_preferences.sql` (preferences; the private budget column is readable only by its owner) `0003_plans.sql` (plans; organisers can read and edit their own, nobody can read the table directly - invite links go through the server) and `0004_members_swipes.sql` (members, their private answers, swipes and votes; no browser policy can read swipes or another member's budget).
2. Google Cloud console: create an OAuth client (type Web). Authorised redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`. In Supabase, Authentication > Providers > Google: paste the client ID and secret. Authentication > URL configuration: add `http://localhost:3000/**` and your production URL followed by `/**` to the redirect allow-list (the wildcard matters: the sign-in return address carries a `?next=` part).
3. Put `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` and restart. The demo sign-in page switches off and the button opens Google.
4. Optional now, needed for real map search and restaurants: `GOOGLE_MAPS_SERVER_KEY` (Places API (New)). Without it, area search uses the built-in locality list.

**Untested until you do this:** the Google OAuth round trip, the callback route, the users and preferences table policies, and the Places requests (their request shapes are covered by mocked tests only).

**Demo mode** (no Supabase yet): the profile lives in an HMAC-signed httpOnly cookie in your own browser, so each person sees only their own data. Set `MOCK_SESSION_SECRET` (32+ characters) if you ever run demo mode outside local development.

## The flow (one page per step)

Organiser: `/` sign in → `/profile` → `/preferences` → `/home` → `/plan/new` → `/plan/[id]/share` →
`/plan/[id]/lobby` → `/plan/[id]/swipe` → `/plan/[id]/results` → `/plan/[id]/winner` → `/plan/[id]/rate`

Friend: `/j/[code]` → lobby → swipe → results → winner → rate. Solo: `/solo`. Policy: `/privacy`.

All tunable numbers (deck size, radius, weights, ₹ per price level, limits) are in `src/config.ts`.

## Demo-mode notes (M3)

- Without Supabase keys, plans are kept in `.data/plans.json` (git-ignored) so an invite link opens in another browser on the same machine. This store refuses to run in production unless `ALLOW_DEMO_STORE=1`.
- Invite links last until 12 hours after the plan starts. A bad link shows the "isn't available" page with HTTP 200 (not 404) so the response doesn't reveal whether a code ever existed.
- The link-preview image uses the default font, so plan names in non-Latin scripts may not render in it. The page itself is unaffected.
- Not yet tested against real services: Supabase policies for plans (`0003`), the service-role invite lookup, and how WhatsApp itself renders the preview (it needs a public URL).

## Known gaps (M4-M8)

- **Deck refinement is not built.** The spec has a left swipe replace the card with a more similar one. With everyone swiping the same 10 places that would make decks differ, so the reserve is stored but unused. A good place to use it is a second round when nobody agrees.
- **No live push.** The lobby and waiting screens poll every 3-5 seconds. Supabase Realtime can replace that.
- **Anyone who hasn't answered by the deadline is left out**, rather than using a saved profile (a friend's saved tastes aren't readable by the organiser's session in demo mode).
- **Voting closes** when everyone has swiped, when the organiser taps "show the shortlist now", or 45 minutes after picking starts.
- **Untested against real services:** the Supabase implementation of the group store and migration 0004, Google Places and Routes, and the winner links on real phones.
- **Dev-only:** `next.config.ts` allows the loopback addresses 127.0.0.1-3 so one person can test as three people (each address has its own cookies).

## Demo mode on Vercel

With no Supabase project, a Vercel deployment runs on a temporary demo database with no settings to add: data lives in the server's `/tmp`, and the session cookie is signed with a key derived from the deployment, so everyone signs in again after each deploy. Pages show a "Demo database" notice. `/tmp` belongs to one server instance and is wiped when it is recycled, so plans can vanish and requests that land on another instance won't see them. It is for trying Binged with a few friends; [SETUP.md](SETUP.md) replaces it with Supabase.

## Try the demo (`/demo`)

A button on the welcome page opens a two-minute guided tour with no sign-in: you are Asha, and Ravi and Meera are pretend friends who swipe on their own (`src/lib/demo.ts`). It builds a real deck with the same pool and matching code, then walks through swipe, shortlist, compare and winner, including the final vote when the friends disagree. It runs entirely in the browser and is a static page, so it works on Vercel with no database and saves nothing.
