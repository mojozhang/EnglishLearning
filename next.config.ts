import type { NextConfig } from "next";

// Trigger Rebuild: fast-xml-parser fix for EPUB at 2026-02-13T14:32

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
