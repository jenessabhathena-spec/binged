// Which real services are configured. Until keys exist, Binged runs on mocks (SPEC §12: seed data and
// mocked Google responses), and the UI says so rather than pretending.

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  // Optional. When set (production), invite links use it. When empty, links use the address the request came to.
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
  // Server-only values are read where they are used (never imported into client components):
  //   SUPABASE_SERVICE_ROLE_KEY, GOOGLE_MAPS_SERVER_KEY
};

export const isSupabaseConfigured = () => Boolean(env.supabaseUrl && env.supabaseAnonKey);

// True on Vercel (it sets VERCEL) while there is still no Supabase project. The app then runs on a temporary
// demo database kept in the server's /tmp: fine for trying it with a few friends, not for anything that matters.
export const isHostedDemo = () => Boolean(process.env.VERCEL) && !isSupabaseConfigured();

// Server only. Never call from a client component: the key must not reach the browser.
export const isGooglePlacesConfigured = () => Boolean(process.env.GOOGLE_MAPS_SERVER_KEY);
