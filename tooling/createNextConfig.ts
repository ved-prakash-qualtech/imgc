import "./loadRootEnv";
import bundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { env } from "../packages/constants/env/env";
import {
  ZONE_DEV_PORT,
  ZONE_PATHS,
  zoneAssetPrefix,
  type ContentZone,
  type Zone,
} from "../packages/i18n/zones";
import { routing } from "../packages/i18n/routing";

/**
 * The one place the Next.js configuration is written. Each app's `next.config.ts` calls
 * `createNextConfig({ zone, appDir })`, so the security headers, the workspace-package wiring and
 * Sentry cannot drift between zones.
 */
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const withBundleAnalyzer = bundleAnalyzer({
  enabled: env.analyzeEnabled,
});

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
  // vercel.com/api/blob is where the browser sends a document when it uploads straight to Blob
  // (`attachUpload`); without it the upload is blocked with nothing but a console message.
  "connect-src 'self' https://*.sentry.io https://*.ingest.sentry.io https://vercel.com",
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

const WORKSPACE_PACKAGES = [
  "@imgc/i18n",
  "@imgc/types",
  "@imgc/constants",
  "@imgc/config",
  "@imgc/utils",
  "@imgc/lib",
  "@imgc/hooks",
  "@imgc/ui",
  "@imgc/store",
  "@imgc/data",
  "@imgc/actions",
  "@imgc/features",
];

/** Where a content zone is reached from the shell. Overridable per deployment. */
function zoneOrigin(zone: ContentZone): string {
  const configured = process.env[`${zone.toUpperCase()}_ZONE_URL`]?.trim();
  // eslint-disable-next-line security/detect-object-injection -- `zone` is one of the literal ContentZone keys
  return (configured || `http://localhost:${ZONE_DEV_PORT[zone]}`).replace(
    /\/$/,
    ""
  );
}

/**
 * The shell is the single front door: every path another zone serves is rewritten to that zone,
 * in every locale, together with the zone's static assets.
 */
function shellRewrites() {
  const prefixes = [
    "",
    ...routing.locales
      .filter((locale) => locale !== routing.defaultLocale)
      .map((locale) => `/${locale}`),
  ];
  const rules: { source: string; destination: string }[] = [];
  for (const zone of Object.keys(ZONE_PATHS) as ContentZone[]) {
    const origin = zoneOrigin(zone);
    // eslint-disable-next-line security/detect-object-injection -- `zone` is one of the literal keys of ZONE_PATHS
    for (const path of ZONE_PATHS[zone]) {
      for (const prefix of prefixes) {
        rules.push({
          source: `${prefix}${path}`,
          destination: `${origin}${prefix}${path}`,
        });
        rules.push({
          source: `${prefix}${path}/:rest*`,
          destination: `${origin}${prefix}${path}/:rest*`,
        });
      }
    }
    const assets = zoneAssetPrefix(zone);
    rules.push({
      source: `${assets}/:rest+`,
      destination: `${origin}${assets}/:rest+`,
    });
  }
  return rules;
}

export function createNextConfig({
  zone,
  appDir,
}: {
  zone: Zone;
  appDir: string;
}): NextConfig {
  const nextConfig: NextConfig = {
    reactStrictMode: true,
    // Workspace packages ship TypeScript source; Next compiles them as part of the app.
    transpilePackages: WORKSPACE_PACKAGES,
    reactCompiler: true,
    output: "standalone",
    poweredByHeader: false,
    // The workspace packages live above the app folder, so both the bundler and the file tracer
    // have to start from the repository root.
    turbopack: { root: repoRoot },
    outputFileTracingRoot: repoRoot,
    env: { NEXT_PUBLIC_ZONE: zone },
    // Content zones serve their assets under a prefix of their own so the shell can route them;
    // the shell keeps the site root. BASE_PATH (an edge mounting the whole portal under a path)
    // composes with either.
    ...(zone === "shell"
      ? basePath
        ? { assetPrefix: basePath }
        : {}
      : { assetPrefix: `${basePath}${zoneAssetPrefix(zone)}` }),
    ...(devOriginPatterns.length
      ? { allowedDevOrigins: devOriginPatterns }
      : {}),
    ...(zone === "shell"
      ? {
          /**
           * The two pre-seeded Initial Claim PDFs live in `public/demo/` and are recorded on their
           * document rows as absolute filesystem paths (see `materialiseChecklist`). `public/` is
           * served by Vercel's static layer, which is a different thing from being present on the
           * function's own filesystem — so `fs.readFile` on that path, which works locally, found
           * nothing once deployed. File tracing is how a serverless function is told to carry a
           * file it never imports: without this the download route falls back to fetching the
           * asset over HTTP, and that request arrives without a session, gets redirected to the
           * login page, and hands back HTML labelled as a PDF.
           */
          outputFileTracingIncludes: {
            "/api/portal/files/[fileId]": ["./public/demo/**"],
          },
          async rewrites() {
            return {
              beforeFiles: shellRewrites(),
              afterFiles: [],
              fallback: [],
            };
          },
        }
      : {}),
    async headers() {
      return [{ source: "/(.*)", headers: securityHeaders }];
    },
    productionBrowserSourceMaps: env.sourceMapsEnabled,
    experimental: {
      // Required by forbidden(), which the dashboard shell calls when the signed-in user reaches a
      // route no granted menu covers. Without it Next throws instead of rendering the Forbidden
      // page, and the guard turns every ungranted route into "Something went wrong".
      authInterrupts: true,
      // The shell proxies to the zones; in development a zone compiles its page on first request, which
      // can outlast the default 30 s and surface as a socket hang up through the rewrite.
      proxyTimeout: 300_000,
      // In local development an upload travels inside the Server Action request, and Next's
      // default cap is 1 MB — any real-world PDF over 1 MB was rejected before the app saw it.
      // 16 MB fits the app's own 15 MB limit (`MAX_UPLOAD_BYTES`) plus the multipart envelope. On
      // a deployment the browser uploads straight to Blob (`attachUpload`), so the file never
      // enters this request and Vercel's 4.5 MB request cap does not apply.
      serverActions: { bodySizeLimit: "16mb" },
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

  void appDir;
  return withBundleAnalyzer(
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
}
