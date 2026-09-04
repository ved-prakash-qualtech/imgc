import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import open from "open";
import waitOn from "wait-on";

const port = process.env.PORT ?? "3000";
const url = process.env.DEV_URL ?? `http://localhost:${port}`;
const openBrowser = process.env.DEV_OPEN_BROWSER !== "false";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const composeFile = path.join(repoRoot, "docker-compose.dev.yml");

const compose = spawn(
  "docker",
  ["compose", "-f", composeFile, "up", "--build"],
  { stdio: "inherit", cwd: repoRoot }
);

let opened = false;

async function openBrowserOnce() {
  if (!openBrowser || opened) return;
  opened = true;
  try {
    await waitOn({
      resources: [`http-get://127.0.0.1:${port}`],
      timeout: 300_000,
      validateStatus: (status) => status >= 200 && status < 500,
    });
    await open(url);
  } catch (error) {
    console.warn(
      "[docker:dev] Could not open browser:",
      error instanceof Error ? error.message : error
    );
  }
}

void openBrowserOnce();

compose.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    compose.kill(signal);
  });
}
