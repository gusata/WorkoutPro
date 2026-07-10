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

  turbopack: {
    root: __dirname,
  },

  experimental: {
    optimizePackageImports: ["next/font", "lucide-react", "date-fns"],
  },
};

export default nextConfig;
