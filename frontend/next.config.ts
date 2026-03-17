import type { NextConfig } from "next";
import path from "path";

const API_BACKEND = process.env.NEXT_PUBLIC_API_BACKEND || "http://localhost:8000";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${API_BACKEND}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
