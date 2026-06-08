import { createAdminClient } from "../src/lib/supabase/admin.mjs";

async function run() {
  const admin = createAdminClient();
  // Find attendance entries with logout_time IS NULL and date < today
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const { data: rows, error } = await admin
    .from("attendance")
    .select("id, user_id, date, login_time")
    .lt("date", todayStr)
    .is("logout_time", null);

  if (error) {
    console.error("Failed to fetch attendance rows:", error.message);
    process.exit(1);
  }

  for (const r of rows ?? []) {
    try {
      const logoutTime = new Date(`${r.date}T10:00:00Z`).toISOString();
      await admin
        .from("attendance")
        .update({ logout_time: logoutTime, auto_checkout: true })
        .eq("id", r.id);

      // increment strike
      const { data: userRow } = await admin.from("users").select("id, strikes, email, name").eq("id", r.user_id).single();
      const current = (userRow?.strikes as number) ?? 0;
      await admin.from("users").update({ strikes: current + 1 }).eq("id", r.user_id);

      // audit log
      await admin.from("audit_log").insert({
        user_id: r.user_id,
        action: "auto_checkout",
        entity_type: "attendance",
        entity_id: r.id,
        reason: "Auto checkout due to missing checkout by 10:00 AM",
      });

      // notify user
      await admin.from("notifications").insert({
        user_id: r.user_id,
        title: "Auto checkout",
        message: "You were automatically checked out and received a strike.",
        link: "/attendance",
      });
    } catch (e) {
      console.error("Failed processing row", r.id, e);
    }
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
