import { execFileSync, spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import open from "open";
import https from "node:https";

import { startFrontDoor } from "./devFrontDoor.mjs";
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
for (const envFile of [".env", ".env.local"]) {
  const full = path.join(projectRoot, envFile);
  if (fs.existsSync(full)) process.loadEnvFile(full);
}

const port = process.env.PORT ?? "3000";
const openBrowser =
  process.env.DEV_OPEN_BROWSER !== "false" &&
  !process.argv.includes("--no-open");

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
const useHttps =
  process.env.DEV_HTTPS !== "false" && !process.argv.includes("--no-https");
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

/*
 * Two local mistakes that each looked like an application bug the first time they happened:
 *
 * - A second dev server on the same checkout. Both write `.next/` and `.data/`, so each one's build
 *   cache and database writes land underneath the other's, and pages fail with errors that point
 *   anywhere but here.
 * - Unresolved merge-conflict markers. The server starts, then every page that imports the file
 *   fails to compile, and the error names a syntax problem rather than the merge.
 *
 * Both are cheap to detect before Next starts, so refuse to start instead.
 */
function portInUse(portNumber) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", (error) => resolve(error.code === "EADDRINUSE"));
    probe.once("listening", () => probe.close(() => resolve(false)));
    probe.listen(Number(portNumber));
  });
}

function conflictMarkers() {
  try {
    return execFileSync(
      "git",
      [
        "grep",
        "-nE",
        "^(<<<<<<<|>>>>>>>)( |$)",
        "--",
        "apps",
        "packages",
        "tooling",
        "scripts",
        "test",
        "*.ts",
        "*.mjs",
      ],
      {
        cwd: projectRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }
    ).trim();
  } catch {
    // `git grep` exits 1 when nothing matches; no git at all is also not a reason to block.
    return "";
  }
}

/*
 * One server per zone, and a small reverse proxy (scripts/devFrontDoor.mjs) on `port` (3000) in
 * front of them. The browser only ever talks to the proxy, which sends each path to the zone that
 * owns it and forwards WebSocket upgrades — the shell's own rewrites cannot, and without the
 * hot-reload socket a zone page never becomes interactive. The shell itself listens on an internal
 * port; the zones need no HTTPS of their own, the proxy terminates it.
 */
const SHELL_PORT = 3004;
const ALL_ZONES = [
  { name: "shell", port: SHELL_PORT },
  { name: "claims", port: 3001 },
  { name: "loans", port: 3002 },
  { name: "admin", port: 3003 },
];

/*
 * Four dev servers are a lot for a laptop — each holds its own compiler. `--zones=shell,claims` (or
 * DEV_ZONES) starts only those; a path owned by a zone that is not running answers with an error
 * from the shell's rewrite, and nothing else is affected. The shell is always started.
 */
const zoneArg =
  process.argv
    .find((arg) => arg.startsWith("--zones="))
    ?.slice("--zones=".length) ?? process.env.DEV_ZONES;
const wanted = zoneArg
  ? new Set(zoneArg.split(",").map((z) => z.trim()))
  : null;
const ZONES = ALL_ZONES.filter(
  (zone) => zone.name === "shell" || !wanted || wanted.has(zone.name)
);

for (const zone of [...ZONES, { name: "front door", port: Number(port) }]) {
  if (await portInUse(zone.port)) {
    console.error(
      `\n[dev] Port ${zone.port} (${zone.name}) is already in use - most likely another dev server for this project.\n` +
        "[dev] Stop it first: two servers share .data/ and break each other's data.\n"
    );
    process.exit(1);
  }
}

/*
 * Start every zone from a clean `.next`. A build cache left by a crashed or killed run (or only
 * half deleted by hand) is the usual reason a zone comes up answering 404 for every route, with
 * nothing logged. The cost is one cold compile per zone, which the sequential warm-up pays anyway.
 * DEV_KEEP_CACHE=1 keeps it.
 */
if (process.env.DEV_KEEP_CACHE !== "1") {
  for (const zone of ZONES) {
    try {
      fs.rmSync(path.join(projectRoot, "apps", zone.name, ".next"), {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 200,
      });
    } catch (error) {
      console.error(
        `\n[dev] Could not clear apps/${zone.name}/.next (${error instanceof Error ? error.message : error}).\n` +
          "[dev] Another process is still using it - stop any running dev server for this project first.\n"
      );
      process.exit(1);
    }
  }
}

const markers = conflictMarkers();
if (markers) {
  console.error(
    "\n[dev] Unresolved merge-conflict markers — resolve these before starting:\n" +
      markers
        .split("\n")
        .map((line) => `[dev]   ${line}`)
        .join("\n") +
      "\n"
  );
  process.exit(1);
}

const nextBin = path.join(projectRoot, "node_modules/next/dist/bin/next");

/** Prefix every line a zone prints so four servers stay readable in one terminal. */
function prefixed(stream, tag) {
  let rest = "";
  stream.on("data", (chunk) => {
    const lines = (rest + chunk.toString()).split(/\r?\n/);
    rest = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) console.log(`[${tag}] ${line}`);
  });
}

/*
 * The zones are started one at a time, each one warmed before the next begins.
 *
 * Four dev servers cold-starting together make each one watch the others' build output, and a zone
 * whose first request lands in that noise can come up with an empty route table: every page it owns
 * answers 404 until it is restarted, with nothing logged. Starting them in sequence, and sending
 * each a request that makes it scan its routes while the machine is quiet, avoids that. It adds a
 * minute or so to startup; the alternative is a portal that signs you in and then says "not found".
 */
const children = [];
let stopping = false;
function stopAll(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exit(code);
}

/** A page each zone serves, so the warm-up request makes it register and compile its routes. */
const WARM_PATH = {
  shell: "/hi/login",
  claims: "/hi/claim-dashboard",
  loans: "/hi/dashboard",
  admin: "/hi/admin/users",
};

/*
 * A signed-in cookie for the warm-up, made the same way `signSession` makes one.
 *
 * It has to be a real page request: a zone whose first request is a redirect to sign-in (or a
 * 404) is the one that comes up with no routes. Only the signature is checked on the way in, so
 * the user in it need not exist; the page may well answer with an error, and that does not matter —
 * by then the zone has compiled and registered everything it serves.
 */
function warmCookie() {
  let secret = process.env.SESSION_SECRET?.trim();
  for (const file of [".env.local", ".env"]) {
    const full = path.join(projectRoot, file);
    /* eslint-disable security/detect-non-literal-fs-filename -- one of two fixed file names in the repo root */
    if (secret || !fs.existsSync(full)) continue;
    secret = parseEnv(fs.readFileSync(full, "utf8")).SESSION_SECRET?.trim();
    /* eslint-enable security/detect-non-literal-fs-filename */
  }
  secret ||= "imgc-local-dev-session-secret";
  const payload = Buffer.from(
    JSON.stringify({
      userId: "dev-warm-up",
      role: "IMGC",
      name: "Dev warm-up",
      email: "warm-up@imgc.in",
      issuedAt: Date.now(),
    })
  ).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `imgc_session=${payload}.${signature}`;
}

/** Resolves to the HTTP status of the warm-up request, or undefined when it could not be made. */
async function warm(zone) {
  try {
    await waitOn({
      resources: [`tcp:127.0.0.1:${zone.port}`],
      timeout: 60_000,
    });
    if (zone.name === "shell" && useHttps) {
      // The shell's own certificate is not in Node's trust store.
      return await new Promise((resolve) => {
        https
          .get(
            `https://127.0.0.1:${zone.port}${WARM_PATH.shell}`,
            { rejectUnauthorized: false, timeout: 300_000 },
            (response) => {
              response.resume();
              response.on("end", () => resolve(response.statusCode));
            }
          )
          .on("error", () => resolve(undefined));
      });
    }
    const response = await fetch(
      `http://localhost:${zone.port}${WARM_PATH[zone.name]}`,
      {
        redirect: "manual",
        headers: zone.name === "shell" ? {} : { cookie: warmCookie() },
        signal: AbortSignal.timeout(300_000),
      }
    );
    return response.status;
  } catch (error) {
    console.warn(
      `[dev] Could not warm ${zone.name}:`,
      error instanceof Error ? error.message : error
    );
    return undefined;
  }
}

function startZone(zone) {
  const nextArgs = [nextBin, "dev", "-p", String(zone.port)];
  // Turbopack is the default. Webpack (DEV_BUNDLER=webpack) is not usable behind the shell: its dev
  // server loads page chunks without the zone's assetPrefix, so they 404 and the page never
  // hydrates.
  if (process.env.DEV_BUNDLER === "webpack") nextArgs.push("--webpack");
  if (zone.name === "shell" && useHttps) nextArgs.push("--experimental-https");
  const child = spawn(process.execPath, nextArgs, {
    cwd: path.join(projectRoot, "apps", zone.name),
    stdio: ["inherit", "pipe", "pipe"],
    env: process.env,
  });
  prefixed(child.stdout, zone.name);
  prefixed(child.stderr, zone.name);
  child.on("exit", (code, signal) => {
    if (!child.restarting) stopAll(code ?? (signal ? 1 : 0));
  });
  children.push(child);
  return child;
}

async function restartZone(zone, child) {
  child.restarting = true;
  children.splice(children.indexOf(child), 1);
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill();
  await Promise.race([exited, new Promise((r) => setTimeout(r, 10_000))]);
  fs.rmSync(path.join(projectRoot, "apps", zone.name, ".next"), {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
}

/*
 * A content zone's first request answering 404 means it came up with an empty route table (see the
 * note above). It stays that way until restarted, so restart it here — with a clean cache — rather
 * than hand the browser a portal that signs you in and then says "not found".
 */
for (const zone of [...ZONES].reverse()) {
  let child = startZone(zone);
  let status = await warm(zone);
  for (
    let attempt = 1;
    attempt <= 3 && zone.name !== "shell" && status === 404;
    attempt++
  ) {
    console.warn(
      `[dev] ${zone.name} came up without its routes (404) - restarting it (attempt ${attempt}).`
    );
    await restartZone(zone, child);
    child = startZone(zone);
    status = await warm(zone);
  }
  if (zone.name !== "shell" && status === 404) {
    console.error(
      `[dev] ${zone.name} still answers 404 - its pages will not load.`
    );
  }
}

const certDir = path.join(projectRoot, "apps", "shell", "certificates");
let tlsFiles;
if (useHttps) {
  fs.mkdirSync(certDir, { recursive: true });
  const rootCert = path.join(projectRoot, "certificates", "localhost.pem");
  const rootKey = path.join(projectRoot, "certificates", "localhost-key.pem");
  const shellCert = path.join(certDir, "localhost.pem");
  const shellKey = path.join(certDir, "localhost-key.pem");
  if (!fs.existsSync(shellCert) && fs.existsSync(rootCert)) {
    fs.copyFileSync(rootCert, shellCert);
  }
  if (!fs.existsSync(shellKey) && fs.existsSync(rootKey)) {
    fs.copyFileSync(rootKey, shellKey);
  }
  tlsFiles = {
    cert: shellCert,
    key: shellKey,
  };
  // Next writes the dev certificate when the shell starts; the front door serves with it.
  await waitOn({
    resources: [`file:${tlsFiles.cert}`, `file:${tlsFiles.key}`],
    timeout: 60_000,
  });
}
startFrontDoor({
  port: Number(port),
  scheme,
  shell: { port: SHELL_PORT, tls: useHttps },
  zones: Object.fromEntries(
    ZONES.filter((zone) => zone.name !== "shell").map((zone) => [
      zone.name,
      zone.port,
    ])
  ),
  tlsFiles,
});
console.log(`[dev] All zones are up and warmed. Open ${url}`);

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

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
