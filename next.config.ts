import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "picsum.photos" }, { protocol: "https", hostname: "images.unsplash.com" }],
  },
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
