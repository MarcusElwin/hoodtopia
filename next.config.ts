import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',

  // Agent cards are served by a catch-all route, not a rewrite — see
  // src/app/a2a/[agent]/[...wellKnown]/route.ts. Only the root-level JWKS
  // still needs one, and nothing internal depends on it: verification reads
  // /a2a/jwks directly, so this exists purely so the keys are also reachable
  // at the conventional path.
  async rewrites() {
    return [
      {
        source: "/.well-known/jwks.json",
        destination: "/a2a/jwks",
      },
    ];
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
