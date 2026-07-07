import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/** IST-aware date helpers (matches existing attendance.ts convention) */
function toIST(date: Date): Date {
  const istString = date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  return new Date(istString);
}

export function getISTDateString(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Monday (as YYYY-MM-DD) of the IST week containing `date`. */
export function getWeekStart(date: Date = new Date()): string {
  const ist = toIST(date);
  const day = ist.getDay(); // 0 = Sunday, 1 = Monday...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  ist.setDate(ist.getDate() + diffToMonday);
  ist.setHours(0, 0, 0, 0);
  return ist.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Sunday 23:59:59 IST (as YYYY-MM-DD) of the week containing `date`. */
export function getWeekEndDeadline(date: Date = new Date()): string {
  const weekStart = getWeekStart(date);
  const start = new Date(weekStart + "T00:00:00");
  start.setDate(start.getDate() + 6); // Monday + 6 = Sunday
  return start.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

// ============================================================
// GRACE PERIOD (check-in) — 30 min grace, 2 uses per week
// ============================================================

const GRACE_MINUTES = 30;
const GRACE_LIMIT_PER_WEEK = 2;

export interface CheckinEvaluation {
  /** Final attendance status to save */
  status: "present" | "late";
  /** true if a strike must be added for this check-in */
  strikeTriggered: boolean;
  /** true if this check-in consumed a grace slot */
  graceUsed: boolean;
}

/**
 * Evaluates a check-in against shift start + grace rules.
 * Rule: on time -> present. Late but within 30min grace and grace-uses < 2 -> present (grace used).
 * Late (whether within or beyond 30min grace) once grace uses are exhausted (>=2 already used this week) -> strike.
 */
export async function evaluateCheckin(
  userId: string,
  shiftStart: string,
  checkinTime: Date
): Promise<CheckinEvaluation> {
  const admin = createAdminClient();

  const istDateStr = checkinTime.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const shiftStartToday = new Date(`${istDateStr}T${shiftStart}+05:30`);

  const isLate = checkinTime > shiftStartToday;

  if (!isLate) {
    return { status: "present", strikeTriggered: false, graceUsed: false };
  }

  const graceDeadline = new Date(shiftStartToday.getTime() + GRACE_MINUTES * 60 * 1000);
  const withinGraceWindow = checkinTime <= graceDeadline;

  const weekStart = getWeekStart(checkinTime);
  const { data: graceRow } = await admin
    .from("grace_usage")
    .select("id, used_count")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  const usedSoFar = graceRow?.used_count ?? 0;
  const graceAvailable = usedSoFar < GRACE_LIMIT_PER_WEEK;

  // Grace only "saves" the check-in if late arrival is within the 30-min window
  // AND the user hasn't already used up their 2 grace slots this week.
  if (withinGraceWindow && graceAvailable) {
    if (graceRow) {
      await admin
        .from("grace_usage")
        .update({ used_count: usedSoFar + 1 })
        .eq("id", graceRow.id);
    } else {
      await admin.from("grace_usage").insert({
        user_id: userId,
        week_start: weekStart,
        used_count: 1,
      });
    }
    return { status: "present", strikeTriggered: false, graceUsed: true };
  }

  // Grace exhausted (3rd+ late this week) OR arrived beyond the 30-min window -> strike.
  return { status: "late", strikeTriggered: true, graceUsed: false };
}

/** Resets a user's grace-usage counter for the current week (called after a strike is added). */
export async function resetGraceUsage(userId: string, date: Date = new Date()): Promise<void> {
  const admin = createAdminClient();
  const weekStart = getWeekStart(date);
  await admin
    .from("grace_usage")
    .upsert(
      { user_id: userId, week_start: weekStart, used_count: 0 },
      { onConflict: "user_id,week_start" }
    );
}

// ============================================================
// STRIKES
// ============================================================

export type StrikeReason = "late_checkin" | "missed_checkout" | "fine_deadline_missed";

/** Adds a strike, resets grace-usage counter, and checks whether a new fine should be raised. */
export async function addStrike(
  userId: string,
  reason: StrikeReason,
  sourceId: string | null = null
): Promise<{ strikeId: string; fineCreated: boolean }> {
  const admin = createAdminClient();
  const now = new Date();

  const { data: strike, error } = await admin
    .from("strikes")
    .insert({ user_id: userId, reason, source_id: sourceId })
    .select("id")
    .single();

  if (error || !strike) {
    throw new Error(`Failed to add strike: ${error?.message ?? "unknown error"}`);
  }

  // Grace-usage counter resets whenever ANY strike lands (per spec rule 1).
  await resetGraceUsage(userId, now);

  const fineCreated = await checkAndCreateFine(userId);

  await admin.from("audit_log").insert({
    user_id: userId,
    action: `strike_added_${reason}`,
    entity_type: "strike",
    entity_id: strike.id,
  });

  return { strikeId: strike.id, fineCreated };
}

/**
 * Every 3 un-fined strikes -> 1 new fine of ₹100.
 * Multiple fines can be created in one call if strikes accumulated fast (e.g. 6 -> 2 fines).
 */
export async function checkAndCreateFine(userId: string): Promise<boolean> {
  const admin = createAdminClient();

  const { data: unfinedStrikes, error } = await admin
    .from("strikes")
    .select("id")
    .eq("user_id", userId)
    .eq("is_removed", false)
    .is("fine_id", null)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to check strikes for fine: ${error.message}`);
  if (!unfinedStrikes || unfinedStrikes.length < 3) return false;

  let created = false;
  let pool = unfinedStrikes;

  while (pool.length >= 3) {
    const batch = pool.slice(0, 3);
    pool = pool.slice(3);

    const deadline = getWeekEndDeadline(new Date());

    const { data: fine, error: fineError } = await admin
      .from("fines")
      .insert({
        user_id: userId,
        amount: 100,
        strikes_count: 3,
        status: "pending",
        deadline,
      })
      .select("id")
      .single();

    if (fineError || !fine) {
      throw new Error(`Failed to create fine: ${fineError?.message ?? "unknown error"}`);
    }

    await admin
      .from("strikes")
      .update({ fine_id: fine.id })
      .in(
        "id",
        batch.map((s) => s.id)
      );

    await admin.from("notifications").insert({
      user_id: userId,
      title: "Fine raised — ₹100",
      message: `3 strikes complete ho gaye — ₹100 ka fine laga hai. Deadline: ${deadline}`,
      link: "/attendance",
      type: "fine",
    });

    created = true;
  }

  return created;
}

/** Super_admin-only: soft-remove a strike (never hard-deleted, immutable history preserved). */
export async function removeStrike(
  strikeId: string,
  removedBy: string,
  reason: string
): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin
    .from("strikes")
    .update({
      is_removed: true,
      removed_by: removedBy,
      removed_reason: reason,
      removed_at: new Date().toISOString(),
    })
    .eq("id", strikeId);

  if (error) throw new Error(`Failed to remove strike: ${error.message}`);

  await admin.from("audit_log").insert({
    user_id: removedBy,
    action: "strike_removed",
    entity_type: "strike",
    entity_id: strikeId,
    reason,
  });
}

// ============================================================
// FINE DEADLINE SWEEP (run via cron, e.g. Sunday 23:59 IST)
// Any fine still "pending" past its deadline -> +1 automatic strike.
// ============================================================
export async function sweepOverdueFines(): Promise<number> {
  const admin = createAdminClient();
  const today = getISTDateString();

  const { data: overdue, error } = await admin
    .from("fines")
    .select("id, user_id")
    .eq("status", "pending")
    .lt("deadline", today);

  if (error) throw new Error(`Failed to sweep overdue fines: ${error.message}`);
  if (!overdue || overdue.length === 0) return 0;

  for (const fine of overdue) {
    await addStrike(fine.user_id, "fine_deadline_missed", fine.id);
  }

  return overdue.length;
}

// ============================================================
// CANNOT-COMPLETE USAGE (1 free/day, 2nd+ needs super_admin approval)
// ============================================================
export async function evaluateCannotComplete(
  userId: string,
  taskId: string,
  reason: string
): Promise<{ status: "auto_accepted" | "pending_approval"; usageId: string }> {
  const admin = createAdminClient();
  const today = getISTDateString();

  const { count } = await admin
    .from("cannot_complete_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("date", today);

  const status = (count ?? 0) >= 1 ? "pending_approval" : "auto_accepted";

  const { data: usage, error } = await admin
    .from("cannot_complete_usage")
    .insert({ user_id: userId, task_id: taskId, date: today, reason, status })
    .select("id")
    .single();

  if (error || !usage) {
    throw new Error(`Failed to record cannot-complete usage: ${error?.message ?? "unknown"}`);
  }

  return { status, usageId: usage.id };
}

/** Super_admin approves/rejects a pending cannot-complete usage. Checkout unblocks on approve. */
export async function reviewCannotComplete(
  usageId: string,
  reviewerId: string,
  decision: "approved" | "rejected"
): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin
    .from("cannot_complete_usage")
    .update({ status: decision, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq("id", usageId);

  if (error) throw new Error(`Failed to review cannot-complete usage: ${error.message}`);

  await admin.from("audit_log").insert({
    user_id: reviewerId,
    action: `cannot_complete_${decision}`,
    entity_type: "cannot_complete_usage",
    entity_id: usageId,
  });
}

/** True if the user currently has any pending_approval cannot-complete usage (blocks checkout). */
export async function hasPendingCannotCompleteApproval(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("cannot_complete_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "pending_approval");
  return (count ?? 0) > 0;
}

// ============================================================
// MISSED CHECKOUT (auto-checkout sweep — run via cron every 5-10 min)
// Shift-end + 1hr grace passed and still checked in -> force checkout + strike.
// ============================================================
export async function sweepMissedCheckouts(): Promise<number> {
  const admin = createAdminClient();
  const now = new Date();

  const { data: checkedInUsers, error } = await admin
    .from("users")
    .select("id, shift_end, is_checked_in")
    .eq("is_checked_in", true)
    .eq("is_active", true);

  if (error) throw new Error(`Failed to sweep checkouts: ${error.message}`);
  if (!checkedInUsers || checkedInUsers.length === 0) return 0;

  let processed = 0;
  const today = getISTDateString(now);

  for (const user of checkedInUsers) {
    const shiftEndToday = new Date(`${today}T${user.shift_end}+05:30`);
    const cutoff = new Date(shiftEndToday.getTime() + 60 * 60 * 1000); // +1hr grace

    if (now <= cutoff) continue;

    const { data: attendance } = await admin
      .from("attendance")
      .select("id, checkout_time")
      .eq("user_id", user.id)
      .eq("date", today)
      .is("checkout_time", null)
      .order("checkin_time", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!attendance) continue;

    await admin
      .from("attendance")
      .update({
        checkout_time: now.toISOString(),
        logout_time: now.toISOString(),
        auto_checkout: true,
      })
      .eq("id", attendance.id);

    await admin.from("users").update({ is_checked_in: false }).eq("id", user.id);

    await addStrike(user.id, "missed_checkout", attendance.id);

    await admin.from("notifications").insert({
      user_id: user.id,
      title: "Auto-checkout",
      message: "Shift-end + 1hr grace ke baad system ne khud checkout kar diya. 1 strike lagi hai.",
      link: "/attendance",
      type: "attendance",
    });

    processed += 1;
  }

  return processed;
}