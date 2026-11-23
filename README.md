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
| M4-M10 | Not started. Each page shows what it will do and which milestone builds it. |

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

1. Create a Supabase project. In the SQL editor run, in order, `supabase/migrations/0001_users.sql` (the users table, its Row Level Security and the trigger that copies your Google name, email and photo on first sign-in) `0002_preferences.sql` (preferences; the private budget column is readable only by its owner) and `0003_plans.sql` (plans; organisers can read and edit their own, nobody can read the table directly - invite links go through the server).
2. Google Cloud console: create an OAuth client (type Web). Authorised redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`. In Supabase, Authentication > Providers > Google: paste the client ID and secret. Authentication > URL configuration: add `http://localhost:3000/auth/callback` and your production URL `/auth/callback` to the redirect allow-list.
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
