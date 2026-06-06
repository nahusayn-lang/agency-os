// Safe public environment values. Avoid throwing at module import time so
// this file can be imported in client bundles without crashing when
// build/runtime replacements are not present.
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
} as const;
