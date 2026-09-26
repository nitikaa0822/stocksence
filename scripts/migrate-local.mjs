import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const config = JSON.parse(await readFile("dist/server/wrangler.json", "utf8"));
const binding = config.d1_databases?.[0]?.binding;
const stateDirectory = process.argv[2] || ".wrangler/state";
if (!binding)
  throw new Error(
    "Build with the DB binding enabled before running migrations.",
  );
function execute(args, json = false) {
  const r = spawnSync(
    process.execPath,
    [
      "--import",
      "./scripts/sites-env.mjs",
      "./node_modules/wrangler/bin/wrangler.js",
      "d1",
      "execute",
      binding,
      "--local",
      "--config",
      "dist/server/wrangler.json",
      "--persist-to",
      stateDirectory,
      ...args,
      ...(json ? ["--json"] : []),
    ],
    {
      encoding: "utf8",
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    },
  );
  if (r.status !== 0)
    throw new Error(r.stderr || r.stdout || "Local migration failed.");
  return json ? JSON.parse(r.stdout) : r.stdout;
}
execute([
  "--command",
  "CREATE TABLE IF NOT EXISTS _stocksense_local_migrations(name TEXT PRIMARY KEY)",
]);
const result = execute(
  ["--command", "SELECT name FROM _stocksense_local_migrations"],
  true,
);
const applied = new Set(
  result.flatMap((r) => r.results || []).map((r) => r.name),
);
for (const file of (await readdir("drizzle"))
  .filter((f) => /^\d+_[a-zA-Z0-9_]+\.sql$/.test(f))
  .sort()) {
  if (applied.has(file)) {
    console.log(`Already applied: ${file}`);
    continue;
  }
  console.log(`Applying ${file}`);
  execute(["--file", path.join("drizzle", file)]);
  execute([
    "--command",
    `INSERT INTO _stocksense_local_migrations(name) VALUES('${file}')`,
  ]);
}
console.log("Local inventory database is ready.");
