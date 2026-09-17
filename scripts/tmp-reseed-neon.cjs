const fs = require("fs");
const { neon } = require("@neondatabase/serverless");

for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.trim().match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

(async () => {
  const sql = neon(process.env.DATABASE_URL);
  const before = await sql`SELECT name, version FROM imgc_snapshots ORDER BY name`;
  console.log("before:", before.map((r) => r.name + " v" + r.version).join(" | "));
  await sql`DELETE FROM imgc_snapshots WHERE name IN ('db', 'audit')`;
  const after = await sql`SELECT name, version FROM imgc_snapshots ORDER BY name`;
  console.log("after :", after.length ? after.map((r) => r.name + " v" + r.version).join(" | ") : "(no live rows — next request reseeds)");
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
