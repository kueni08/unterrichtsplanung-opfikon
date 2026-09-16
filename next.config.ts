import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.GITHUB_ACTIONS ? "export" : undefined,
  basePath: process.env.GITHUB_ACTIONS ? "/unterrichtsplanung-opfikon" : undefined,
  assetPrefix: process.env.GITHUB_ACTIONS ? "/unterrichtsplanung-opfikon/" : undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
