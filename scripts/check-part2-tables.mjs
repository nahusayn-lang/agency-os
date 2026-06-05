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
    // optional
  }
}

loadEnvLocal();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const tables = ["tasks", "task_comments", "task_activity", "leads", "lead_audit"];

let allOk = true;
for (const table of tables) {
  const { error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) {
    console.log(`FAIL ${table}: ${error.message}`);
    allOk = false;
  } else {
    console.log(`OK ${table}`);
  }
}
process.exit(allOk ? 0 : 1);
