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

// The Redis REST address and token, if set (Vercel's Upstash integration sets KV_REST_API_URL / KV_REST_API_TOKEN).
export const redisRest = (): { url: string; token: string } | null => {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
};

// True on Vercel (it sets VERCEL) while there is still no Supabase project. The app then runs on a demo database:
// Redis if one is connected, otherwise temporary server storage. Fine for trying it with friends, not for anything
// that matters.
export const isHostedDemo = () => Boolean(process.env.VERCEL) && !isSupabaseConfigured();

// Server only. Never call from a client component: the key must not reach the browser.
export const isGooglePlacesConfigured = () => Boolean(process.env.GOOGLE_MAPS_SERVER_KEY);
