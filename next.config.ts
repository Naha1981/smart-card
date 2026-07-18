import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "5mb" }, // catalog CSV pastes, images
  },
};

export default nextConfig;
