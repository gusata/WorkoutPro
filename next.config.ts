import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,

  compress: true,
  devIndicators: false,
  poweredByHeader: false,

  images: {
    unoptimized: true,
  },

  experimental: {
    optimizePackageImports: ["next/font"],
  },
};

export default nextConfig;
