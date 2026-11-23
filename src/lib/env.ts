// Which real services are configured. Until keys exist, Binged runs on mocks (SPEC §12: seed data and
// mocked Google responses), and the UI says so rather than pretending.

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  // Server-only values are read where they are used (never imported into client components):
  //   SUPABASE_SERVICE_ROLE_KEY, GOOGLE_MAPS_SERVER_KEY
};

export const isSupabaseConfigured = () => Boolean(env.supabaseUrl && env.supabaseAnonKey);

// Server only. Never call from a client component: the key must not reach the browser.
export const isGooglePlacesConfigured = () => Boolean(process.env.GOOGLE_MAPS_SERVER_KEY);
