import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      ...(process.env.TRPC_URL
        ? [
            {
              source: "/api/trpc/:slug*",
              destination: new URL("/:slug*", process.env.TRPC_URL).toString(),
            },
          ]
        : []),
    ];
  },
  output: "standalone",
};

export default nextConfig;
