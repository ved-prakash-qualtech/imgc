import bundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { env } from "./src/lib/utils/env/env";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const withBundleAnalyzer = bundleAnalyzer({
  enabled: env.analyzeEnabled,
});

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * QCP security baseline (aligned with node-nextjs-template).
 * CSP allows blob workers/images for react-pdf; Sentry ingest when enabled.
 * `'unsafe-eval'` is dev-only (React Refresh).
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${env.isProduction ? "" : " 'unsafe-eval'"}`,
  "worker-src 'self' blob:",
  "connect-src 'self' https://*.sentry.io https://*.ingest.sentry.io",
  "form-action 'self'",
  // Production only. This directive rewrites every http:// subresource to https://, and a
  // dev server on plain http has nothing listening there — so the browser upgrades the
  // stylesheet request, gets nothing, and renders the page as raw HTML with no styles and
  // no obvious cause. curl fetches the same CSS perfectly, which sends you looking
  // anywhere but the security headers.
  ...(env.isProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const MAX_CHUNK_SIZE_BYTES = 476 * 1024;

/*
 * Development only, and only when DEV_HOSTNAME is set.
 *
 * Scope is resolved from the hostname, so local runs happen on a real application host rather
 * than on localhost — and Next then treats its own dev resources as cross-origin and blocks
 * them. The symptom is not an error: the page renders server-side and then nothing on it
 * responds to a click, because the client bundle never arrived.
 *
 * DEV_HOSTNAME alone is not enough, and this is the trap. It names the admin host, so the admin
 * console works and everything looks configured — but the whole point of running on a real
 * hostname is that a tenant host resolves a different scope, and every one of those is a
 * different origin that is still blocked. What you get is an admin console that behaves and a
 * tenant console where every button is dead, which reads as a bug in the tenant screens.
 *
 * Hence the base domain as a wildcard: tenants are onboarded at runtime, so listing them would
 * mean editing this file and restarting for each new one. Development only either way — Next
 * ignores allowedDevOrigins in a production build.
 */
const devHostname = process.env.DEV_HOSTNAME?.trim();

/** `admin-boilerplate-local.qualtechedge.in` → `*.qualtechedge.in`, covering every tenant host. */
const devOriginPatterns = (() => {
  if (!devHostname) return [];
  const baseDomain = devHostname.split(".").slice(1).join(".");
  return baseDomain ? [devHostname, `*.${baseDomain}`] : [devHostname];
})();

/**
 * The path this application is served under, when it is not served at the site root.
 *
 * Empty for every deployment that gets its own hostname — ibs, lms, the tenant consoles — and that
 * is the default, so nothing changes for them. It is set only where an edge puts several services
 * on one host behind path prefixes, as mws-uat-onprem does at /boilerplate/.
 *
 * Without it Next writes its asset URLs from the site root: the page itself loads, and every
 * stylesheet and script asks for /_next/... where another service's catch-all answers. On
 * mws-uat-onprem that answer was 47 bytes of text/plain, so the browser discarded the CSS and
 * rendered the page unstyled with broken images. Nothing 404s, which is what makes it slow to spot.
 *
 * Applied as assetPrefix and deliberately not as basePath. QShip's edge strips the prefix before
 * forwarding, because a service mounted under one almost always serves from its own root, so
 * Next receives "/" and must keep its routes there — basePath would make every one of them
 * 404. assetPrefix changes only where the asset URLs point, which is the half that was wrong.
 *
 * Next reads this at build time, not at run time — set it as a build-time variable, or the image
 * is built for the site root whatever the container's environment later says.
 */
const basePath = (process.env.BASE_PATH ?? "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  reactCompiler: true,
  output: "standalone",
  poweredByHeader: false,
  turbopack: { root: dirname },
  ...(basePath ? { assetPrefix: basePath } : {}),
  ...(devOriginPatterns.length ? { allowedDevOrigins: devOriginPatterns } : {}),
  /**
   * The two pre-seeded Initial Claim PDFs live in `public/demo/` and are recorded on their
   * document rows as absolute filesystem paths (see `materialiseChecklist`). `public/` is served
   * by Vercel's static layer, which is a different thing from being present on the function's own
   * filesystem — so `fs.readFile` on that path, which works locally, found nothing once deployed.
   * File tracing is how a serverless function is told to carry a file it never imports: without
   * this the download route falls back to fetching the asset over HTTP, and that request arrives
   * without a session, gets redirected to the login page, and hands back HTML labelled as a PDF.
   */
  outputFileTracingIncludes: {
    "/api/portal/files/[fileId]": ["./public/demo/**"],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  productionBrowserSourceMaps: env.sourceMapsEnabled,
  experimental: {
    // Required by forbidden(), which the dashboard shell calls when the signed-in user reaches a
    // route no granted menu covers. Without it Next throws instead of rendering the Forbidden page,
    // and the guard turns every ungranted route into "Something went wrong".
    authInterrupts: true,
    serverSourceMaps: env.sourceMapsEnabled,
    turbopackSourceMaps: env.sourceMapsEnabled,
    turbopackInputSourceMaps: env.sourceMapsEnabled,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization = config.optimization ?? {};
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        maxSize: MAX_CHUNK_SIZE_BYTES,
      };
    }

    return config;
  },
};

export default withBundleAnalyzer(
  withNextIntl(
    env.isSentryEnabled
      ? withSentryConfig(nextConfig, {
          org: env.sentryOrg,
          project: env.sentryProject,
          authToken: env.sentryAuthToken,
          silent: !env.isCi,
          widenClientFileUpload: true,
          tunnelRoute: "/monitoring",
        })
      : nextConfig
  )
);
