import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Dev only: lets this machine open the dev server under other loopback addresses, so one person can test as
  // several people (each address keeps its own cookies).
  allowedDevOrigins: ["127.0.0.1", "127.0.0.2", "127.0.0.3"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
