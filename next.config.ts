import type { NextConfig } from "next";

// Trigger Rebuild: Standardized adm-zip import at 2026-02-13T14:15

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
