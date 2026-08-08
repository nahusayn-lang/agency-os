import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser, notifyUsers } from "@/lib/notifications/notify";

/**
 * Two jobs in one sweep, meant to run every ~15 minutes:
 *
 * 1. REMINDERS — leads in "meeting" stage whose meeting_datetime falls
 *    within the next 30 minutes and hasn't been reminded yet
 *    (meeting_reminder_sent = false) get a push to their assignee.
 *
 * 2. OVERDUE — leads in "meeting" stage whose meeting_datetime is more
 *    than 2 hours in the past (meeting presumably happened, nobody
 *    updated the lead) get flagged to the assignee AND founders, once,
 *    using meeting_reminder_sent as the same "already handled" flag so
 *    it doesn't repeat every sweep. Rescheduling resets the flag.
 */
export async function sweepMeetingReminders(): Promise<{
  reminders: number;
  overdueFlags: number;
}> {
  const admin = createAdminClient();
  const now = new Date();
  const in30min = new Date(now.getTime() + 30 * 60 * 1000);
  const overdueThreshold = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  // --- Upcoming meeting reminders ---
  const { data: upcoming, error: upcomingError } = await admin
    .from("leads")
    .select("id, business_name, assigned_to, meeting_datetime")
    .eq("stage", "meeting")
    .eq("meeting_reminder_sent", false)
    .not("meeting_datetime", "is", null)
    .gte("meeting_datetime", now.toISOString())
    .lte("meeting_datetime", in30min.toISOString());

  if (upcomingError) {
    throw new Error(`Failed to sweep meeting reminders: ${upcomingError.message}`);
  }

  for (const lead of upcoming ?? []) {
    await admin.from("leads").update({ meeting_reminder_sent: true }).eq("id", lead.id);

    const time = new Date(lead.meeting_datetime as string).toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    await notifyUser({
      userId: lead.assigned_to,
      title: "Meeting starting soon",
      message: `Meeting with "${lead.business_name}" is at ${time} — coming up in the next 30 minutes.`,
      link: `/crm/${lead.id}`,
      type: "meeting_reminder",
      referenceId: lead.id,
    });
  }

  // --- Overdue meetings (past, still un-actioned) ---
  const { data: overdue, error: overdueError } = await admin
    .from("leads")
    .select("id, business_name, assigned_to, meeting_datetime")
    .eq("stage", "meeting")
    .eq("meeting_reminder_sent", false)
    .not("meeting_datetime", "is", null)
    .lt("meeting_datetime", overdueThreshold.toISOString());

  if (overdueError) {
    throw new Error(`Failed to sweep overdue meetings: ${overdueError.message}`);
  }

  for (const lead of overdue ?? []) {
    await admin.from("leads").update({ meeting_reminder_sent: true }).eq("id", lead.id);

    await notifyUser({
      userId: lead.assigned_to,
      title: "Meeting needs an update",
      message: `The scheduled meeting with "${lead.business_name}" has passed. Move the lead forward or reschedule.`,
      link: `/crm/${lead.id}`,
      type: "meeting_overdue",
      referenceId: lead.id,
    });

    const { data: founders } = await admin
      .from("users")
      .select("id")
      .eq("role", "super_admin")
      .eq("is_active", true);

    if (founders?.length) {
      await notifyUsers(
        founders.map((f) => f.id),
        {
          title: "Meeting overdue",
          message: `Meeting with "${lead.business_name}" has passed with no update.`,
          link: `/crm/${lead.id}`,
          type: "meeting_overdue",
          referenceId: lead.id,
        }
      );
    }
  }

  return { reminders: upcoming?.length ?? 0, overdueFlags: overdue?.length ?? 0 };
}