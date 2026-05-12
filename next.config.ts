import type { NextConfig } from "next";
import { storefrontImageRemotePatterns } from "./lib/storefront-image-config";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core"],
  images: {
    remotePatterns: storefrontImageRemotePatterns,
  },
};

export default nextConfig;
