import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack config only applies to dev mode (next dev)
  // Production builds use webpack automatically
  experimental: {
    turbo: {
      rules: {
        "*.css": {
          loaders: ["@tailwindcss/turbopack"],
          as: "*.css",
        },
      },
    },
  },
  // Required for Three.js and satellite.js
  transpilePackages: [],
  // Skip type checking during build for faster deploys
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
