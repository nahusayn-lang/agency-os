import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import React from "react";
import WorkSessionCardClient from "./work-session-card-client";

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
      <WorkSessionCardClient
        isCheckedIn={isCheckedIn}
        checkInTime={checkInTime}
        isBlocked={isBlocked}
      />
    </section>
  );
}
