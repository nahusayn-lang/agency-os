/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "zsgfrjezanfedylekelw.supabase.co",
      },
    ],
  },
  experimental: {
    // Keeps recently-visited pages cached on the client for this many
    // seconds, so back/forward navigation is instant instead of
    // re-fetching from the server every time. Mutations still bust this
    // cache immediately via revalidatePath(), so this can't show stale
    // data after an edit — it only helps plain browsing back and forth.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;