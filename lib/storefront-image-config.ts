/**
 * Keep in sync with `images.remotePatterns` in `next.config.ts`.
 * Used to decide when `next/image` is allowed vs fallback `<img>`.
 */
export const STOREFRONT_IMAGE_EXACT_HOSTS = new Set(
  [
    "cdn.shopify.com",
    "cdn.shopifycdn.net",
    "res.cloudinary.com",
    "images.ctfassets.net",
    "images.prismic.io",
    "cdn.sanity.io",
  ].map((h) => h.toLowerCase()),
);

export const STOREFRONT_IMAGE_HOST_SUFFIXES = [
  ".shopifycdn.com",
  ".shopifycdn.net",
  ".cloudinary.com",
  ".imgix.net",
  ".fastly.net",
  ".akamaized.net",
];

export function isNextImageAllowedForUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    if (STOREFRONT_IMAGE_EXACT_HOSTS.has(h)) return true;
    return STOREFRONT_IMAGE_HOST_SUFFIXES.some((s) => h.endsWith(s));
  } catch {
    return false;
  }
}

/** Patterns passed to Next.js `images.remotePatterns` */
export const storefrontImageRemotePatterns = [
  { protocol: "https" as const, hostname: "cdn.shopify.com", pathname: "/**" },
  { protocol: "https" as const, hostname: "cdn.shopifycdn.net", pathname: "/**" },
  { protocol: "https" as const, hostname: "*.shopifycdn.com", pathname: "/**" },
  { protocol: "https" as const, hostname: "*.shopifycdn.net", pathname: "/**" },
  { protocol: "https" as const, hostname: "res.cloudinary.com", pathname: "/**" },
  { protocol: "https" as const, hostname: "*.cloudinary.com", pathname: "/**" },
  { protocol: "https" as const, hostname: "images.ctfassets.net", pathname: "/**" },
  { protocol: "https" as const, hostname: "images.prismic.io", pathname: "/**" },
  { protocol: "https" as const, hostname: "cdn.sanity.io", pathname: "/**" },
  { protocol: "https" as const, hostname: "*.imgix.net", pathname: "/**" },
  { protocol: "https" as const, hostname: "*.fastly.net", pathname: "/**" },
  { protocol: "https" as const, hostname: "*.akamaized.net", pathname: "/**" },
];
