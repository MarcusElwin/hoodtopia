import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',

  // A2A agent cards live at the spec's well-known path. Next's App Router
  // will not serve a route segment starting with a dot, so the well-known URL
  // is rewritten onto /a2a/<agent>/card, which is a normal route.
  async rewrites() {
    return [
      {
        source: "/a2a/:agent/.well-known/agent-card.json",
        destination: "/a2a/:agent/card",
      },
      // Public keys for verifying those cards.
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
