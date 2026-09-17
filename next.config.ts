import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
  typescript: { tsconfigPath: "tsconfig.next.json" },
  output: process.env.GITHUB_ACTIONS ? "export" : undefined,
  basePath: process.env.GITHUB_ACTIONS ? "/unterrichtsplanung-opfikon" : undefined,
  assetPrefix: process.env.GITHUB_ACTIONS ? "/unterrichtsplanung-opfikon/" : undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
