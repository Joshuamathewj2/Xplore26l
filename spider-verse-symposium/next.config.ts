import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * STATIC EXPORT — `next build` emits plain HTML/CSS/JS into `out/`.
   *
   * Every route here prerenders as static (the whole experience is client-side
   * WebGL + scroll), so there is nothing for a server to do per request.
   * Exporting to files lets Azure Static Web Apps serve the site straight off
   * its global CDN: it scales without an origin to saturate, stays on the Free
   * tier, and sidesteps Azure's hybrid/SSR Next.js support, which historically
   * lags behind current Next releases.
   *
   * If something later genuinely needs SSR or route handlers, drop `output`
   * and move the SWA plan to Standard.
   */
  output: "export",

  /**
   * next/image's default loader optimises on demand, which needs a server a
   * static export doesn't have. Nothing here depends on it — the hero art is
   * 3D, not <Image> — so images are served as authored.
   */
  images: { unoptimized: true },

  /** Emit `/events/index.html` rather than `/events.html` so directory-style
   *  URLs resolve on the CDN without extra rewrite rules. */
  trailingSlash: true,
};

export default nextConfig;
