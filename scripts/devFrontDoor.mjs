/* eslint-disable security/detect-non-literal-fs-filename, security/detect-non-literal-regexp, security/detect-object-injection -- local dev tooling: paths are repo-owned and keys come from the zone table */
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import path from "node:path";
import tls from "node:tls";
import { fileURLToPath } from "node:url";

/**
 * The development front door: one address for the whole portal, in front of the four dev servers.
 *
 * In production an edge (or the shell's rewrites) routes each path to the zone that owns it. In
 * development that cannot be the shell's rewrites: Next's dev server does not forward WebSocket
 * upgrades through a rewrite, so the hot-reload socket (`/<zone>-static/_next/webpack-hmr`) never
 * connects, and a page whose hot-reload socket is down never finishes loading its JavaScript — it
 * renders, and then nothing on it responds to a click.
 *
 * This is a plain reverse proxy that does forward upgrades. Routing is by the same table the shell
 * uses (`ZONE_PATHS`, read from packages/i18n/zones.ts so there is one list), and the `Host` the
 * browser used is passed through unchanged.
 */
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

function readZonePaths() {
  const source = fs.readFileSync(
    path.join(projectRoot, "packages/i18n/zones.ts"),
    "utf8"
  );
  const block = source.slice(source.indexOf("export const ZONE_PATHS"));
  const paths = {};
  for (const zone of ["claims", "loans", "admin"]) {
    const match = block.match(new RegExp(`${zone}:\\s*\\[([^\\]]*)\\]`));
    paths[zone] = [...(match?.[1] ?? "").matchAll(/"([^"]+)"/g)].map(
      (m) => m[1]
    );
  }
  return paths;
}

/**
 * @param {{ port: number, hostname?: string, scheme: "http" | "https",
 *   shell: { port: number, tls: boolean },
 *   zones: Record<string, number>, tlsFiles?: { cert: string, key: string } }} options
 */
export function startFrontDoor(options) {
  const zonePaths = readZonePaths();

  function route(url) {
    const pathname = url.split("?")[0];
    for (const zone of Object.keys(zonePaths)) {
      if (pathname.startsWith(`/${zone}-static/`)) return zone;
    }
    const bare = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
    for (const [zone, prefixes] of Object.entries(zonePaths)) {
      if (prefixes.some((p) => bare === p || bare.startsWith(`${p}/`))) {
        return zone;
      }
    }
    return "shell";
  }

  function target(url) {
    const zone = route(url);
    if (zone === "shell") return { ...options.shell, zone };
    const port = options.zones[zone];
    // A zone that is not running (--zones=...) is answered with an error, not a hang.
    return port ? { port, tls: false, zone } : null;
  }

  function forwardedHeaders(req) {
    const headers = { ...req.headers };
    headers["x-forwarded-host"] = req.headers.host ?? "";
    headers["x-forwarded-proto"] = options.scheme;
    return headers;
  }

  function onRequest(req, res) {
    const t = target(req.url ?? "/");
    if (!t) {
      res.writeHead(502, { "content-type": "text/plain" });
      res.end(`[dev] The zone for ${req.url} is not running.`);
      return;
    }
    const client = t.tls ? https : http;
    const upstream = client.request(
      {
        host: "127.0.0.1",
        port: t.port,
        method: req.method,
        path: req.url,
        headers: forwardedHeaders(req),
        rejectUnauthorized: false,
      },
      (response) => {
        res.writeHead(response.statusCode ?? 502, response.headers);
        response.pipe(res);
      }
    );
    upstream.on("error", (error) => {
      if (!res.headersSent)
        res.writeHead(502, { "content-type": "text/plain" });
      res.end(`[dev] ${t.zone} is not reachable: ${error.message}`);
    });
    req.pipe(upstream);
  }

  function onUpgrade(req, socket, head) {
    const t = target(req.url ?? "/");
    if (!t) return socket.destroy();
    const upstream = t.tls
      ? tls.connect({
          host: "127.0.0.1",
          port: t.port,
          rejectUnauthorized: false,
        })
      : net.connect(t.port, "127.0.0.1");
    upstream.on(t.tls ? "secureConnect" : "connect", () => {
      const headers = forwardedHeaders(req);
      let raw = `${req.method} ${req.url} HTTP/1.1\r\n`;
      for (const [name, value] of Object.entries(headers)) {
        raw += `${name}: ${Array.isArray(value) ? value.join(", ") : value}\r\n`;
      }
      upstream.write(`${raw}\r\n`);
      if (head?.length) upstream.write(head);
      socket.pipe(upstream);
      upstream.pipe(socket);
    });
    upstream.on("error", () => socket.destroy());
    socket.on("error", () => upstream.destroy());
    socket.on("close", () => upstream.destroy());
  }

  const server =
    options.scheme === "https"
      ? https.createServer(
          {
            cert: fs.readFileSync(options.tlsFiles.cert),
            key: fs.readFileSync(options.tlsFiles.key),
          },
          onRequest
        )
      : http.createServer(onRequest);
  server.on("upgrade", onUpgrade);
  server.listen(options.port, options.hostname || undefined);
  return server;
}
