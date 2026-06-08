import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import React from "react";

export default async function WorkSessionCard() {
  const profile = await requireUserProfile();
  const supabase = createClient();

  // Today's attendance (if any)
  const today = new Date().toISOString().slice(0, 10);
  const { data: attendance } = await supabase
    .from("attendance")
    .select("id, login_time, logout_time, status")
    .eq("user_id", profile.id)
    .eq("date", today)
    .order("login_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Check if any assigned tasks are not submitted (waiting_review) or completed/approved
  const { data: blocking } = await supabase
    .from("tasks")
    .select("id")
    .eq("assigned_to", profile.id)
    .not("status", "in", "(waiting_review,approved,completed)")
    .limit(1);

  const isCheckedIn = !!attendance?.login_time && !attendance?.logout_time;
  const checkInTime = attendance?.login_time ?? null;
  const isBlocked = (blocking ?? []).length > 0;

  return (
    <section className="rounded-xl border p-6">
      <h2 className="mb-2 text-lg font-medium">Work session</h2>
      <div className="space-y-2">
        <div>Checked in: {isCheckedIn ? new Date(checkInTime!).toLocaleString() : "No"}</div>
        {isCheckedIn && <div>Current session: <span id="ws-duration">calculating…</span></div>}
        <div>Working status: {isCheckedIn ? (isBlocked ? "Blocked" : "Working") : "Not started"}</div>
      </div>

      <div className="mt-4 flex gap-2">
        {!isCheckedIn && (
          <form action="/api/attendance/checkin" method="POST">
            <button className="btn" type="submit">Check In</button>
          </form>
        )}

        {isCheckedIn && (
          <form action="/api/attendance/checkout" method="POST">
            <button className="btn" type="submit" disabled={isBlocked}>Check Out</button>
          </form>
        )}
      </div>

      {isBlocked && (
        <div className="mt-4">
          <label htmlFor="emergency_note">Emergency note</label>
          <form action="/api/requests/emergency" method="POST" className="mt-2">
            <input id="emergency_note" name="note" className="w-full rounded border p-2" />
            <div className="mt-2">
              <button className="btn" type="submit">Send Approval Request</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
