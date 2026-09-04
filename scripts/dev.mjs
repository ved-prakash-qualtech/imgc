import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import open from "open";
import waitOn from "wait-on";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

/*
 * Next reads `.env` for the app, but this wrapper runs before Next exists, so without this the
 * DEV_* settings below come from the shell only — and a DEV_HOSTNAME set in `.env`, which is
 * where every runbook tells you to put it, is silently ignored. The server then comes up on
 * localhost instead of the tenant host, and the first thing that fails is a 403 several steps
 * later with nothing pointing back here.
 */
const envFile = path.join(projectRoot, ".env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const port = process.env.PORT ?? "3000";
const openBrowser = process.env.DEV_OPEN_BROWSER !== "false";

/*
 * HTTPS by default, and on a real application hostname when DEV_HOSTNAME is set.
 *
 * Not a preference — the session cookies are Secure, and a browser silently discards a Secure
 * cookie delivered over http. Sign in over plain http on anything but localhost and the token
 * exchange succeeds, no cookie is stored, and the proxy sends you straight back to sign in: a
 * loop, with nothing logged at either end. The alternative is relaxing that flag for
 * development, which would make local the one environment whose sign-in follows rules nothing
 * deployed uses — and would hide exactly the class of bug local testing exists to catch.
 *
 * Scope is resolved from the hostname, so testing tenant scope means running on a tenant host
 * (`{tenant}-{product}-{env}.qualtechedge.in`) rather than on localhost. Point it at 127.0.0.1
 * in the hosts file and set DEV_HOSTNAME.
 *
 * First run downloads mkcert and prompts for your OS password to install its local root CA;
 * that cannot be scripted, so run `pnpm dev` in an interactive terminal once. Set
 * DEV_HTTPS=false to fall back to plain http on localhost.
 */
const useHttps = process.env.DEV_HTTPS !== "false";
const hostname = process.env.DEV_HOSTNAME ?? "";
const scheme = useHttps ? "https" : "http";
const devHost = hostname || "localhost";
const url = process.env.DEV_URL ?? `${scheme}://${devHost}:${port}`;

/*
 * Next generates its dev certificate for DEV_HOSTNAME alone. That is enough for the admin host and
 * wrong for everything else, because scope is resolved from the hostname: the moment you open a
 * tenant host to test tenant scope, you are on a name the certificate does not cover.
 *
 * The failure is thoroughly misleading. The browser offers to proceed, so the page loads and looks
 * fine — but a cert-error origin is not allowed to open a WebSocket at all, with no bypass, so the
 * only visible symptom is `wss://.../_next/webpack-hmr failed` repeating in the console. Nothing
 * says "certificate", and the page's own JavaScript never settles: links keep working because they
 * are ordinary anchors, while every button silently does nothing.
 *
 * A wildcard covers every tenant, which matters because tenants are onboarded at runtime — naming
 * them individually here would need regenerating the certificate for each new one.
 */
const certPath = path.join(projectRoot, "certificates/localhost.pem");
if (useHttps && hostname && fs.existsSync(certPath)) {
  const cert = fs.readFileSync(certPath, "utf8");
  const baseDomain = hostname.split(".").slice(1).join(".");
  // A rough check on purpose: parsing X.509 to warn about a dev certificate is not worth a
  // dependency, and a false positive costs one ignored line.
  if (baseDomain && !cert.includes("MII")) {
    // unreadable certificate — leave it to Next
  } else if (baseDomain) {
    console.log(
      `
[dev] If tenant hosts under ${baseDomain} show only "webpack-hmr failed" in the console,
` +
        `[dev] the dev certificate does not cover them. Regenerate it with:
` +
        `[dev]   mkcert -cert-file certificates/localhost.pem -key-file certificates/localhost-key.pem \
` +
        `[dev]     localhost 127.0.0.1 ::1 "*.${baseDomain}"
`
    );
  }
}

const nextBin = path.join(projectRoot, "node_modules/next/dist/bin/next");

const nextArgs = [nextBin, "dev"];
if (useHttps) nextArgs.push("--experimental-https");
if (hostname) nextArgs.push("-H", hostname);

const next = spawn(process.execPath, nextArgs, {
  stdio: "inherit",
  env: process.env,
});

let opened = false;

async function openBrowserOnce() {
  if (!openBrowser || opened) return;
  opened = true;
  try {
    // Plain TCP check — avoids a TLS handshake against the self-signed HTTPS cert, which
    // Node's default trust store will not accept.
    await waitOn({
      resources: [`tcp:127.0.0.1:${port}`],
      timeout: 120_000,
    });
    await open(url);
  } catch (error) {
    console.warn(
      "[dev] Could not open browser:",
      error instanceof Error ? error.message : error
    );
  }
}

void openBrowserOnce();

next.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
