import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    unoptimized: true,
  },
  experimental: {
    serverSourceMaps: false,
  },
  async rewrites() {
    return [{ source: '/backend-api/:path*', destination: 'http://127.0.0.1:3001/api/:path*' }];
  },
};

export default nextConfig;
