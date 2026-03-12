import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/manga",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
