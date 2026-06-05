import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "..", "supabase", "migrations");

async function loadMigrations() {
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const migrations = [];
  for (const file of files) {
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    migrations.push({ file, sql });
  }
  return migrations;
}

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;

  if (!dbUrl) {
    console.error(
      "Set SUPABASE_DB_URL to your Supabase Postgres connection string, then rerun."
    );
    console.error(
      "Find it in Supabase Dashboard → Project Settings → Database → Connection string (URI)."
    );
    process.exit(1);
  }

  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: dbUrl });

  await client.connect();

  try {
    await client.query("CREATE SCHEMA IF NOT EXISTS supabase_migrations;");
    await client.query(`
      CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const migrations = await loadMigrations();

    for (const { file, sql } of migrations) {
      const { rows } = await client.query(
        "SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = $1",
        [file]
      );

      if (rows.length > 0) {
        console.log(`Skipping ${file} (already applied)`);
        continue;
      }

      console.log(`Applying ${file}...`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO supabase_migrations.schema_migrations (version) VALUES ($1)",
          [file]
        );
        await client.query("COMMIT");
        console.log(`Applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    console.log("All migrations applied.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
