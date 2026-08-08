import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications/notify";

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
// GRACE PERIOD (check-in)
// 0–30 min after shift start: always free, no fine, no weekly limit.
// 30–60 min after shift start: "grace" — allowed only 2 times per week.
// 60+ min after shift start: always late + strike.
// ============================================================

const FREE_WINDOW_MINUTES = 30;
const EXTRA_GRACE_MINUTES = 30; // on top of the free window, i.e. up to 60 min total
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
 * Evaluates a check-in against shift start + the two-tier window rule.
 * - On time, or within 30 min of shift start -> always present, no fine, no weekly limit.
 * - 30–60 min late -> present IF a weekly grace slot (max 2/week) is available, else late+strike.
 * - 60+ min late -> always late + strike, regardless of grace quota.
 */
export async function evaluateCheckin(
  userId: string,
  shiftStart: string,
  checkinTime: Date
): Promise<CheckinEvaluation> {
  const admin = createAdminClient();

  const istDateStr = checkinTime.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const shiftStartToday = new Date(`${istDateStr}T${shiftStart}+05:30`);

  const freeWindowDeadline = new Date(shiftStartToday.getTime() + FREE_WINDOW_MINUTES * 60 * 1000);

  // Within the first 30 min of shift start (or early/on time) — always free.
  if (checkinTime <= freeWindowDeadline) {
    return { status: "present", strikeTriggered: false, graceUsed: false };
  }

  const graceDeadline = new Date(
    shiftStartToday.getTime() + (FREE_WINDOW_MINUTES + EXTRA_GRACE_MINUTES) * 60 * 1000
  );
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

  // Grace only "saves" the check-in if arrival is within the 30–60 min window
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

  // Grace exhausted (3rd+ late this week within 30-60min) OR arrived beyond
  // the 60-min total window -> strike.
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

export type StrikeReason = "late_checkin" | "missed_checkout" | "fine_deadline_missed" | "no_checkin";

/** Adds a strike, resets grace-usage counter, and checks whether a new fine should be raised. */
export async function addStrike(
  userId: string,
  reason: StrikeReason,
  sourceId: string | null = null,
  options?: { notify?: boolean }
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

  // fine_deadline_missed strikes are standalone — they must NOT feed into
  // the general 3-strikes-to-fine pool, else it cascades into new fines.
  const fineCreated =
    reason === "fine_deadline_missed" ? false : await checkAndCreateFine(userId);

  await admin.from("audit_log").insert({
    user_id: userId,
    action: `strike_added_${reason}`,
    entity_type: "strike",
    entity_id: strike.id,
  });

  // "missed_checkout" is skipped here — sweepMissedCheckouts() below already
  // sends its own, more detailed notification (mentions the auto-checkout
  // itself, not just the strike), so this avoids sending the user two
  // notifications for the same event.
  if (reason !== "missed_checkout" && (options?.notify ?? true)) {
    const reasonText: Record<StrikeReason, string> = {
      late_checkin: "Due to late check-in,",
      missed_checkout: "Due to a missed checkout,",
      fine_deadline_missed: "Due to missing the fine deadline,",
      no_checkin: "Due to no check-in for the full day,",
    };
    await notifyUser({
      userId,
      title: "Strike Added",
      message: `${reasonText[reason]} you have received 1 strike.`,
      link: "/attendance",
      type: "strike",
      referenceId: strike.id,
    });
  }

  return { strikeId: strike.id, fineCreated };
}

/** Founder-configurable fine amount (single row settings table). Falls back to ₹149. */
export async function getFineAmount(): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin.from("fine_settings").select("amount").eq("id", 1).maybeSingle();
  return Number(data?.amount ?? 149);
}

/** Super_admin-only: updates the fine amount used for all future fines. */
export async function setFineAmount(amount: number, updatedBy: string): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Fine amount must be a valid positive number.");
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("fine_settings")
    .upsert({ id: 1, amount, updated_by: updatedBy, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Failed to update fine amount: ${error.message}`);

  await admin.from("audit_log").insert({
    user_id: updatedBy,
    action: "fine_amount_updated",
    entity_type: "fine_settings",
    entity_id: "1",
    reason: `New amount: ₹${amount}`,
  });
}

/**
 * Every 3 un-fined strikes -> 1 new fine (amount from fine_settings, default ₹149).
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
    .neq("reason", "fine_deadline_missed") // due-strikes never join the general pool
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to check strikes for fine: ${error.message}`);
  if (!unfinedStrikes || unfinedStrikes.length < 3) return false;

  const fineAmount = await getFineAmount();

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
        amount: fineAmount,
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

    await notifyUser({
      userId,
      title: `Fine Raised — ₹${fineAmount}`,
      message: `You have completed 3 strikes — a fine of ₹${fineAmount} has been issued. Deadline: ${deadline}`,
      link: "/attendance",
      type: "fine",
      referenceId: fine.id,
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

  const { data: strikeRow } = await admin
    .from("strikes")
    .select("user_id")
    .eq("id", strikeId)
    .single();

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

  if (strikeRow?.user_id) {
    await notifyUser({
      userId: strikeRow.user_id,
      title: "Strike Removed",
      message: `One of your strikes has been removed by the founder. Reason: ${reason}`,
      link: "/attendance",
      type: "strike_removed",
      referenceId: strikeId,
    });
  }
}

// ============================================================
// FINE DEADLINE SWEEP (run via cron, e.g. Sunday 23:59 IST)
// Any fine still "pending" past its deadline -> +1 automatic strike.
// ============================================================
export async function sweepOverdueFines(): Promise<number> {
  const admin = createAdminClient();
  const today = getISTDateString();
  const currentWeek = getWeekStart(new Date()); // this week's Monday (IST)

  const { data: overdue, error } = await admin
    .from("fines")
    .select("id, user_id, last_overdue_strike_week")
    .eq("status", "pending")
    .lt("deadline", today);

  if (error) throw new Error(`Failed to sweep overdue fines: ${error.message}`);
  if (!overdue || overdue.length === 0) return 0;

  let processed = 0;
  const strikesByUser = new Map<string, number>();

  for (const fine of overdue) {
    // Already struck for THIS week — skip (prevents the every-few-minutes
    // repeat bug), but allow it again next week if still unpaid (recurring).
    if (fine.last_overdue_strike_week === currentWeek) continue;

    // notify: false — we batch one combined notification per user below,
    // instead of one notification per overdue fine.
    await addStrike(fine.user_id, "fine_deadline_missed", fine.id, { notify: false });
    await admin
      .from("fines")
      .update({ last_overdue_strike_week: currentWeek })
      .eq("id", fine.id);

    strikesByUser.set(fine.user_id, (strikesByUser.get(fine.user_id) ?? 0) + 1);
    processed += 1;
  }

  for (const [userId, count] of strikesByUser) {
    await notifyUser({
      userId,
      title: "Strike Added",
      message:
        count === 1
          ? "Due to missing the fine deadline, you have received 1 strike."
          : `Due to missing the fine deadline, you have received ${count} strikes.`,
      link: "/attendance",
      type: "strike",
    });
  }

  return processed;
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

  const { data: usageRow } = await admin
    .from("cannot_complete_usage")
    .select("user_id, task_id")
    .eq("id", usageId)
    .single();

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

  // Goes back to the exact employee who submitted the request — not admins.
  if (usageRow?.user_id) {
    await notifyUser({
      userId: usageRow.user_id,
      title: decision === "approved" ? "Cannot-Complete Approved" : "Cannot-Complete Rejected",
      message:
        decision === "approved"
          ? "The founder has approved your cannot-complete request — checkout is now unblocked."
          : "The founder has rejected your cannot-complete request.",
      link: usageRow.task_id ? `/tasks/${usageRow.task_id}` : "/tasks",
      type: "cannot_complete_review",
      referenceId: usageId,
    });
  }
}

/**
 * Whenever a new shift's start-time arrives and the user is still
 * checked in to an old (previous shift-occurrence) session, force
 * checkout them immediately — don't wait for the grace/1hr window.
 * This makes a fresh "Check In" card available right away for the new shift.
 *
 * Detection: if the attendance row's `date` (shift-occurrence date) differs
 * from today's date, and today's shift-start time has already passed,
 * that session is "stale" — force close it.
 *
 * Call this on dashboard load (for immediate effect) as well as in the
 * cron sweep (as a background safety net) so it still closes even if
 * the page isn't reloaded.
 */
export async function closeStaleShiftSession(userId: string): Promise<void> {
  const admin = createAdminClient();
  const now = new Date();
  const today = getISTDateString(now);

  const { data: user } = await admin
    .from("users")
    .select("id, shift_start, is_checked_in")
    .eq("id", userId)
    .maybeSingle();

  if (!user?.is_checked_in || !user.shift_start) return;

  const shiftStartToday = new Date(`${today}T${user.shift_start}+05:30`);
  if (now < shiftStartToday) return; // today's shift hasn't started yet

  const { data: attendance } = await admin
    .from("attendance")
    .select("id, date, checkin_time")
    .eq("user_id", userId)
    .is("checkout_time", null)
    .order("checkin_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!attendance || attendance.date === today) return; // same-shift session, chhedo mat

  await admin
    .from("attendance")
    .update({
      checkout_time: now.toISOString(),
      logout_time: now.toISOString(),
      auto_checkout: true,
    })
    .eq("id", attendance.id);

  await admin.from("users").update({ is_checked_in: false }).eq("id", userId);
}

/** Background safety-net (call from cron) — closes any leftover stale sessions
 * for all checked-in users, in case the dashboard wasn't reloaded at the
 * exact shift-boundary moment. */
export async function sweepStaleShiftSessions(): Promise<number> {
  const admin = createAdminClient();
  const { data: checkedInUsers } = await admin
    .from("users")
    .select("id")
    .eq("is_checked_in", true)
    .eq("is_active", true);

  if (!checkedInUsers || checkedInUsers.length === 0) return 0;

  let processed = 0;
  for (const user of checkedInUsers) {
    await closeStaleShiftSession(user.id);
    processed += 1;
  }
  return processed;
}

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
    .select("id, shift_start, shift_end, is_checked_in")
    .eq("is_checked_in", true)
    .eq("is_active", true);

  if (error) throw new Error(`Failed to sweep checkouts: ${error.message}`);
  if (!checkedInUsers || checkedInUsers.length === 0) return 0;

  let processed = 0;

  for (const user of checkedInUsers) {
    if (!user.shift_end) continue;

    const { data: attendance } = await admin
      .from("attendance")
      .select("id, checkin_time, checkout_time, date")
      .eq("user_id", user.id)
      .is("checkout_time", null)
      .order("checkin_time", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!attendance || !attendance.date) continue;

    // Cutoff ab is record ki ASAL check-in date se nikalta hai (jo already
    // "checkin ke din" ki date hoti hai), na ki "aaj ki date" se. Isliye
    // overnight shift bhi sahi se agle din khatam hoti hai, isi shaam nahi.
    const crossesMidnight = !!user.shift_start && user.shift_start > user.shift_end;
    const shiftEndForRecord = new Date(`${attendance.date}T${user.shift_end}+05:30`);
    if (crossesMidnight) shiftEndForRecord.setDate(shiftEndForRecord.getDate() + 1);
    const cutoff = new Date(shiftEndForRecord.getTime() + 60 * 60 * 1000); // +1hr grace

    if (now <= cutoff) continue;

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

    await notifyUser({
      userId: user.id,
      title: "Auto-Checkout",
      message: "The system automatically checked you out after shift end + 1hr grace period. 1 strike has been issued.",
      link: "/attendance",
      type: "attendance",
    });

    processed += 1;
  }

  return processed;
}

// ============================================================
// OFF-DAY CHECK (Sunday toggle + manual holidays)
// Returns true if today is a company-wide non-working day —
// absent/strike/fine must not apply on these dates.
// ============================================================
export async function isGlobalOffDay(dateStr: string): Promise<boolean> {
  const admin = createAdminClient();

  const { data: settings } = await admin
    .from("attendance_settings")
    .select("sunday_off")
    .eq("id", 1)
    .maybeSingle();

  if (settings?.sunday_off) {
    const dayOfWeek = new Date(`${dateStr}T00:00:00`).getDay(); // 0 = Sunday
    if (dayOfWeek === 0) return true;
  }

  const { data: holiday } = await admin
    .from("holidays")
    .select("id")
    .lte("start_date", dateStr)
    .gte("end_date", dateStr)
    .maybeSingle();

  return !!holiday;
}

// ============================================================
// ABSENT SWEEP (run via cron once daily)
// Any active user who hasn't checked in within 1hr of their shift-start,
// and isn't covered by an approved leave for today, gets marked absent
// (an `attendance` row with status "absent") and takes a strike.
// ============================================================
export async function sweepAbsentUsers(): Promise<number> {
  const admin = createAdminClient();
  const now = new Date();
  const today = getISTDateString(now);

  if (await isGlobalOffDay(today)) return 0;

  const { data: activeUsers, error } = await admin
    .from("users")
    .select("id, shift_start, shift_end")
    .eq("is_active", true);

  if (error) throw new Error(`Failed to sweep absent users: ${error.message}`);
  if (!activeUsers || activeUsers.length === 0) return 0;

  let processed = 0;

  for (const user of activeUsers) {
    // Absent is only marked once the entire shift has passed and the user
    // never checked in even once — not right at shift start + a short grace
    // period (that's for "late", handled in evaluateCheckin).
    if (!user.shift_end) continue;
    const shiftEndToday = new Date(`${today}T${user.shift_end}+05:30`);
    const cutoff = shiftEndToday;

    if (now <= cutoff) continue;

    // Already has a record for THIS shift-occurrence — skip. Checked by
    // checkin_time falling inside the shift's actual window (start→end),
    // not by "today's date", since an overnight shift's check-in date can
    // be the previous calendar day.
    const crossesMidnight = user.shift_start > user.shift_end;
    const shiftStartRefDate = new Date(shiftEndToday);
    if (crossesMidnight) shiftStartRefDate.setDate(shiftStartRefDate.getDate() - 1);
    const shiftStartRefDateStr = shiftStartRefDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const shiftStartInstant = new Date(`${shiftStartRefDateStr}T${user.shift_start}+05:30`);

    const { data: attendance } = await admin
      .from("attendance")
      .select("id")
      .eq("user_id", user.id)
      .gte("checkin_time", shiftStartInstant.toISOString())
      .lte("checkin_time", shiftEndToday.toISOString())
      .order("checkin_time", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (attendance) continue;

    // Already marked absent for this shift-occurrence in a previous sweep
    // run — skip, otherwise every cron run re-inserts a fresh absent row
    // + fine + strikes for the same missed shift.
    const { data: alreadyAbsent } = await admin
      .from("attendance")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", shiftStartRefDateStr)
      .eq("status", "absent")
      .maybeSingle();

    if (alreadyAbsent) continue;

    // Covered by an approved leave for today — not absent, skip.
    const { data: approvedLeave } = await admin
      .from("messages")
      .select("id")
      .eq("sender_id", user.id)
      .eq("type", "leave_request")
      .eq("status", "approved")
      .eq("leave_date", today)
      .maybeSingle();

    if (approvedLeave) continue;

    const { error: insertError } = await admin.from("attendance").insert({
      user_id: user.id,
      date: shiftStartRefDateStr,
      status: "absent",
    });

    if (insertError) {
      console.error(`Failed to mark ${user.id} absent:`, insertError.message);
      continue;
    }

 const fineAmount = await getFineAmount();
  const deadline = getWeekEndDeadline(now);

  const { data: fine } = await admin
    .from("fines")
    .insert({ user_id: user.id, amount: fineAmount, strikes_count: 3, status: "pending", deadline })
    .select("id")
    .single();

  await admin.from("strikes").insert([
    { user_id: user.id, reason: "no_checkin", is_removed: false, fine_id: fine?.id ?? null },
    { user_id: user.id, reason: "no_checkin", is_removed: false, fine_id: fine?.id ?? null },
    { user_id: user.id, reason: "no_checkin", is_removed: false, fine_id: fine?.id ?? null },
  ]);

  await notifyUser({
    userId: user.id,
    title: "Marked Absent — Fine Issued",
    message: `No check-in was recorded without an approved leave — a fine of ₹${fineAmount} has been issued directly. Deadline: ${deadline}`,
    link: "/attendance",
    type: "attendance",
  });

    processed += 1;
  }

  return processed;
}

// ============================================================
// DEADLINE REMINDERS (run via cron once daily)
// Pings the affected user once, 1 day before a task/fine deadline.
// ============================================================
export async function sweepDeadlineReminders(): Promise<{ taskReminders: number; fineReminders: number }> {
  const admin = createAdminClient();
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: dueTasks, error: taskError } = await admin
    .from("tasks")
    .select("id, title, assigned_to, deadline")
    .eq("deadline_reminder_sent", false)
    .not("deadline", "is", null)
    .not("status", "in", "(approved,completed)")
    .lte("deadline", in24h.toISOString())
    .gte("deadline", now.toISOString());

  if (taskError) throw new Error(`Failed to sweep task deadlines: ${taskError.message}`);

  // Group by user so someone with several tasks due gets ONE notification,
  // not one per task.
  const tasksByUser = new Map<string, { id: string; title: string }[]>();
  for (const task of dueTasks ?? []) {
    const list = tasksByUser.get(task.assigned_to) ?? [];
    list.push({ id: task.id, title: task.title });
    tasksByUser.set(task.assigned_to, list);
    await admin.from("tasks").update({ deadline_reminder_sent: true }).eq("id", task.id);
  }

  for (const [userId, tasks] of tasksByUser) {
    const isSingle = tasks.length === 1;
    await notifyUser({
      userId,
      title: "Task Deadline Approaching",
      message: isSingle
        ? `"${tasks[0].title}" is due in 24 hours.`
        : `${tasks.length} tasks are due in 24 hours: ${tasks.map((t) => `"${t.title}"`).join(", ")}.`,
      link: isSingle ? `/tasks/${tasks[0].id}` : "/tasks",
      type: "task_deadline_reminder",
      referenceId: isSingle ? tasks[0].id : undefined,
    });
  }

  const tomorrow = getISTDateString(new Date(now.getTime() + 24 * 60 * 60 * 1000));

  const { data: dueFines, error: fineError } = await admin
    .from("fines")
    .select("id, user_id, amount, deadline")
    .eq("status", "pending")
    .eq("reminder_sent", false)
    .lte("deadline", tomorrow);

  if (fineError) throw new Error(`Failed to sweep fine deadlines: ${fineError.message}`);

  // Same batching for fines — one combined notification per user.
  const finesByUser = new Map<string, { id: string; amount: number }[]>();
  for (const fine of dueFines ?? []) {
    const list = finesByUser.get(fine.user_id) ?? [];
    list.push({ id: fine.id, amount: fine.amount });
    finesByUser.set(fine.user_id, list);
    await admin.from("fines").update({ reminder_sent: true }).eq("id", fine.id);
  }

  for (const [userId, fines] of finesByUser) {
    const isSingle = fines.length === 1;
    const total = fines.reduce((sum, f) => sum + f.amount, 0);
    await notifyUser({
      userId,
      title: "Fine Deadline Approaching",
      message: isSingle
        ? `Your ₹${fines[0].amount} fine is due tomorrow.`
        : `You have ${fines.length} fines (₹${total} total) due tomorrow.`,
      link: "/attendance",
      type: "fine_deadline_reminder",
      referenceId: isSingle ? fines[0].id : undefined,
    });
  }

  return { taskReminders: dueTasks?.length ?? 0, fineReminders: dueFines?.length ?? 0 };
}