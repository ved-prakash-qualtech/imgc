import { spawnSync } from "node:child_process";

const [tool, ...files] = process.argv.slice(2);

if (files.length === 0) {
  process.exit(0);
}

/** Stay under Windows cmd.exe ~8191 char limit (paths vary in length). */
const MAX_BATCH_ARG_LENGTH = 6_000;

const TOOL_ARGS = {
  // --max-warnings=0 stops new lint warnings from accumulating in committed code.
  eslint: ["exec", "eslint", "--fix", "--max-warnings=0"],
  prettier: ["exec", "prettier", "--write", "--ignore-unknown"],
  stylelint: ["exec", "stylelint", "--fix"],
};

function* batchFiles(paths) {
  let batch = [];
  let length = 0;

  for (const file of paths) {
    const nextLength = length + file.length + 1;

    if (batch.length > 0 && nextLength > MAX_BATCH_ARG_LENGTH) {
      yield batch;
      batch = [];
      length = 0;
    }

    batch.push(file);
    length += file.length + 1;
  }

  if (batch.length > 0) {
    yield batch;
  }
}

function runBatch(batch) {
  // eslint-disable-next-line security/detect-object-injection
  const baseArgs = TOOL_ARGS[tool];

  if (!baseArgs) {
    console.error(`lint-staged batch runner: unknown tool "${tool}"`);
    process.exit(1);
  }

  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

  // Prevent Windows cmd.exe from breaking on paths with parentheses by quoting them
  const safeBatch =
    process.platform === "win32" ? batch.map((f) => `"${f}"`) : batch;

  const result = spawnSync(command, [...baseArgs, ...safeBatch], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

for (const batch of batchFiles(files)) {
  runBatch(batch);
}
