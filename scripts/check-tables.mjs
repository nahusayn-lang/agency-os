import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (key && rest.length) {
        process.env[key.trim()] ??= rest.join("=").trim();
      }
    }
  } catch {
    // .env.local optional when vars are already exported
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

const tables = ["users", "attendance", "audit_log", "god_mode_overrides"];

for (const table of tables) {
  const { error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) {
    console.log(`❌ ${table}: ${error.message}`);
  } else {
    console.log(`✓ ${table}: exists`);
  }
}
