import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const withMDX = createMDX({
  extension: /\.(md|mdx)$/,
  options: {
    remarkPlugins: ["remark-gfm"],
    // rehypePlugins: [],
  },
});

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
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
};

export default withMDX(nextConfig);
