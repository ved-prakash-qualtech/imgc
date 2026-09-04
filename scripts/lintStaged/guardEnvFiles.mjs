/**
 * Pre-commit guard: refuse to commit any real environment file.
 * Only `.env.example` is allowed in version control; every other `.env*`
 * file may contain secrets/credentials and must never be committed
 * (SOC 2 CC6.1 / ISO 27001 A.8.24 — protection of secrets).
 */
const offending = process.argv
  .slice(2)
  .filter((file) => !/(^|\/)\.env\.example$/.test(file));

if (offending.length > 0) {
  console.error(
    "\u2716 Refusing to commit environment file(s) that may contain secrets:\n" +
      offending.map((file) => `  - ${file}`).join("\n") +
      "\n\nOnly .env.example may be committed. Remove these from the commit."
  );
  process.exit(1);
}
