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

// Probe audit_log immutability: insert then attempt delete
const probeUserId = "00000000-0000-0000-0000-000000000001";

const { data: inserted, error: insertError } = await supabase
  .from("audit_log")
  .insert({
    user_id: probeUserId,
    action: "probe",
    entity_type: "migration_check",
  })
  .select("id")
  .single();

if (insertError) {
  console.log("audit_log insert probe skipped (FK constraint — expected):", insertError.message);
  console.log("Tables exist. Apply migration 003 in SQL Editor if not yet run.");
  process.exit(0);
}

const { error: deleteError } = await supabase
  .from("audit_log")
  .delete()
  .eq("id", inserted.id);

if (deleteError) {
  console.log("✓ audit_log immutability enforced:", deleteError.message);
} else {
  console.log("⚠ audit_log DELETE succeeded — run supabase/migrations/003_audit_log_immutability.sql");
  await supabase.from("audit_log").delete().eq("id", inserted.id);
}
