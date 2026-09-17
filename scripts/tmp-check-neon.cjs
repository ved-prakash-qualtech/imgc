const fs = require("fs");
const { neon } = require("@neondatabase/serverless");

for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.trim().match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

(async () => {
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`SELECT name, version, updated_at FROM imgc_snapshots ORDER BY name`;
  console.log("rows:", rows.map((r) => r.name + " v" + r.version + " @" + r.updated_at).join(" | "));
  const [live] = await sql`SELECT data FROM imgc_snapshots WHERE name = 'db'`;
  if (!live) return console.log("no live db row");
  let d = live.data;
  if (typeof d === "string") d = JSON.parse(d);
  const c = {};
  d.claims.forEach((x) => { c[x.status] = (c[x.status] || 0) + 1; });
  console.log("LIVE claims by status:", JSON.stringify(c));
  console.log("LIVE accounts:", d.accounts.length, "claims:", d.claims.length);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
