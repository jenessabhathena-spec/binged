# Putting Binged online for real (about 30 minutes)

You need three free accounts: **Supabase** (database + sign-in), **Google Cloud** (the "Continue with Google" button)
and **Vercel** (hosting). Do them in this order. Nothing here costs money at this size.

Keep a note open. You will copy three values from Supabase and paste them into Vercel.

## 1. Supabase: the database

1. Go to supabase.com, sign in with GitHub, **New project**. Name it `binged`. Region: **South Asia (Mumbai)**, which is
   closest to Bengaluru. Choose a strong database password and save it somewhere (you won't need it again here).
2. Wait about 2 minutes for it to finish setting up.
3. Left menu **SQL Editor** > **New query**. Open `supabase/setup.sql` from this repo, copy everything, paste, press **Run**.
   You should see "Success. No rows returned". This creates every table and turns on the privacy rules (nobody can read
   another person's budget).
4. Left menu **Project Settings** > **API**. Copy these three:
   - **Project URL** (looks like `https://abcdxyz.supabase.co`)
   - **anon public** key
   - **service_role** key. **This one is a secret.** Never paste it in a chat, never commit it. It goes only into Vercel.

## 2. Google: the sign-in button

1. Go to console.cloud.google.com, create a project called `Binged`.
2. **APIs & Services** > **OAuth consent screen**. User type **External**. App name `Binged`, your email for support and
   developer contact. Leave the scopes as they are (email, profile, openid).
3. On the same screen, press **Publish app** (so anyone with a Gmail can sign in, not just test users). Only basic scopes are
   used, so Google does not need to review it.
4. **Credentials** > **Create credentials** > **OAuth client ID** > type **Web application**. Under **Authorised redirect
   URIs** add: `https://<your-project>.supabase.co/auth/v1/callback` (use your Project URL from step 1.4). Create, then
   copy the **Client ID** and **Client secret**.
5. Back in Supabase: **Authentication** > **Sign In / Providers** > **Google**. Turn it on and paste the Client ID and secret.

## 3. Vercel: the website

1. Go to vercel.com/new, sign in with GitHub, and **Import** the `binged` repository. Keep the default Next.js settings.
2. Before pressing Deploy, open **Environment Variables** and add these three (names exactly as written):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | the Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | the service_role key |

   Do **not** add `MOCK_SESSION_SECRET` or `ALLOW_DEMO_STORE`. Those are only for the demo mode that this replaces.
3. Press **Deploy**. When it finishes you get an address like `https://binged-xxxx.vercel.app`.
4. Back in Supabase: **Authentication** > **URL Configuration**.
   - **Site URL**: your Vercel address.
   - **Redirect URLs**: add `https://binged-xxxx.vercel.app/**` and `http://localhost:3000/**`.
   (The `/**` matters: the sign-in return address carries extra text after the page name.)
5. Optional: add `NEXT_PUBLIC_APP_URL` = your Vercel address in Vercel, then **Redeploy**. Links fall back to the address
   people opened the site on if you skip this.

## 4. Check it works

1. Open your Vercel address and tap **Continue with Google**. You should land on the profile page with your Google name.
2. Make a plan and copy the invite link.
3. Open the link on a phone, or in a private window. Join with just a first name. You should land on the 30-second form.
4. Back as the organiser, the lobby should show the friend. That confirms the database and the privacy rules work.

If something fails, copy the message you see and tell me the step number. Do not paste any keys.

## What changes when this is on

- The demo sign-in page and the local `.data` file go away. Plans live in Supabase, so invite links work for everyone,
  all the time, and nothing depends on your laptop.
- Supabase's free tier pauses a project after a week with no use. Opening the dashboard wakes it.

## Later (not needed to try it with friends)

- `GOOGLE_MAPS_SERVER_KEY` (Places API (New) and Routes API): real restaurants with prices, ratings, phone numbers and
  addresses, and real travel times. Until then cards say "not confirmed yet".
- Billing on Google Cloud is required for that key. Set a budget alert first.
