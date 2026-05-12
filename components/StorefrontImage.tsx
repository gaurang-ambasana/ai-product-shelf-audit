"use client";

import Box from "@mui/material/Box";
import Image from "next/image";
import { isNextImageAllowedForUrl } from "@/lib/storefront-image-config";

type Props = {
  src: string;
  alt: string;
  sizes?: string;
  className?: string;
};

/**
 * Uses `next/image` when the URL host is allowlisted; otherwise falls back to `<img>`.
 */
export function StorefrontImage({ src, alt, sizes = "(max-width: 600px) 100vw, 33vw", className }: Props) {
  const allowed = isNextImageAllowedForUrl(src);

  if (allowed) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className={className}
        style={{ objectFit: "cover" }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- host not in remotePatterns
    <img src={src} alt={alt} className={className} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  );
}

/** Wrapper with aspect ratio + clipping for grid cards */
export function StorefrontImageFrame(props: Props) {
  return (
    <Box
      sx={{
        position: "relative",
        aspectRatio: "4 / 3",
        bgcolor: "action.hover",
        overflow: "hidden",
      }}
    >
      <StorefrontImage {...props} />
    </Box>
  );
}
