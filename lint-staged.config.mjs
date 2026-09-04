/** @type {import("lint-staged").Configuration} */
const config = {
  // Project-wide type check (tsc needs the whole graph, so ignore the file list).
  "*.{ts,tsx}": () => "pnpm exec tsc --noEmit",
  "*.{js,jsx,ts,tsx,mjs,cjs}":
    "node scripts/lintStaged/runInBatches.mjs eslint",
  "*.css": "node scripts/lintStaged/runInBatches.mjs stylelint",
  "*.{js,jsx,ts,tsx,mjs,cjs,css,md,json,yml,yaml}":
    "node scripts/lintStaged/runInBatches.mjs prettier",
  // Block secrets: only .env.example may ever be committed.
  "**/.env*": "node scripts/lintStaged/guardEnvFiles.mjs",
};

export default config;
