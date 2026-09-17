import type { NextConfig } from "next";

const basePath = process.env.GITHUB_ACTIONS ? "/unterrichtsplanung-opfikon" : undefined;

const nextConfig: NextConfig = {
  output: process.env.GITHUB_ACTIONS ? "export" : undefined,
  basePath,
  assetPrefix: process.env.GITHUB_ACTIONS ? "/unterrichtsplanung-opfikon/" : undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath ?? "" },
};

export default nextConfig;
