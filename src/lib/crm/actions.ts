"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { notifyUser, notifyUsers } from "@/lib/notifications/notify";
import {
  ASSIGNEE_CHANGEABLE_STAGES,
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  type LeadEditableField,
  type LeadStage,
  type MeetingHistoryEntry,
} from "@/lib/types/crm";

function serializeValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return String(value);
}

type AuditRow = {
  lead_id: string;
  changed_by: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
};

async function insertAuditRows(
  supabase: ReturnType<typeof createClient>,
  rows: AuditRow[]
) {
  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase.from("lead_audit").insert(rows);

  if (error) {
    throw new Error(error.message);
  }
}

async function writeLeadAuditEntries(
  supabase: ReturnType<typeof createClient>,
  params: {
    leadId: string;
    userId: string;
    changes: Array<{
      field: string;
      oldValue: string | null;
      newValue: string | null;
    }>;
  }
) {
  const rows: AuditRow[] = params.changes.map((change) => ({
    lead_id: params.leadId,
    changed_by: params.userId,
    field_changed: change.field,
    old_value: change.oldValue,
    new_value: change.newValue,
  }));

  await insertAuditRows(supabase, rows);
}

export async function createLeadFormAction(formData: FormData): Promise<void> {
  const result = await createLeadAction(formData);
  if (result?.error) {
    redirect(`/crm?error=${encodeURIComponent(result.error)}`);
  }
}

export async function createLeadAction(formData: FormData) {
  const profile = await requireUserProfile();

  if (profile.role === "member") {
    return { error: "Only admins can create leads." };
  }

  const businessName = String(formData.get("business_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const assignedTo = String(formData.get("assigned_to") ?? "").trim();
  const stage = String(formData.get("stage") ?? "").trim() as LeadStage;
  const nameInput = String(formData.get("name") ?? "").trim();

  if (!businessName || !phone || !assignedTo || !stage) {
    return {
      error: "Business name, phone, assignee, and stage are required.",
    };
  }

  if (!LEAD_STAGES.includes(stage)) {
    return { error: "Invalid stage." };
  }

  const supabase = createClient();

  const assigneeError = await validateLeadAssignee(supabase, assignedTo);
  if (assigneeError) {
    return { error: assigneeError };
  }

  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      name: nameInput || businessName,
      business_name: businessName,
      phone,
      email: String(formData.get("email") ?? "").trim() || null,
      stage,
      deal_value: formData.get("deal_value")
        ? Number(formData.get("deal_value"))
        : null,
      assigned_to: assignedTo,
      notes: String(formData.get("notes") ?? "").trim() || null,
      next_followup: formData.get("next_followup")
        ? new Date(String(formData.get("next_followup"))).toISOString()
        : null,
    })
    .select("id")
    .single();

  if (error || !lead) {
    return { error: error?.message ?? "Failed to create lead." };
  }

  await writeLeadAuditEntries(supabase, {
    leadId: lead.id,
    userId: profile.id,
    changes: [{ field: "stage", oldValue: null, newValue: stage }],
  });

  revalidatePath("/crm");
}

export async function updateLeadStageAction(
  leadId: string,
  newStage: LeadStage,
  meetingInfo?: { datetime: string; note: string }
) {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const { data: lead, error: fetchError } = await supabase
    .from("leads")
    .select("id, stage, assigned_to, business_name, meeting_history")
    .eq("id", leadId)
    .single();

  if (fetchError || !lead) {
    return { error: "Lead not found." };
  }

  if (profile.role === "member" && lead.assigned_to !== profile.id) {
    return { error: "You can only move your own leads." };
  }

  const oldStage = lead.stage as LeadStage;
  if (oldStage === newStage) {
    return { success: true };
  }

  // Moving a lead INTO Meeting is a gated transition: date + time are
  // mandatory (checked here again, never trust the client-side popup
  // alone). Moving OUT of Meeting to anything else needs no extra data.
  const dbUpdates: Record<string, unknown> = { stage: newStage };

  if (newStage === "meeting") {
    if (!meetingInfo?.datetime) {
      return { error: "Meeting date and time are required to move to this stage." };
    }
    const dt = new Date(meetingInfo.datetime);
    if (isNaN(dt.getTime())) {
      return { error: "Invalid meeting date/time." };
    }
    dbUpdates.meeting_datetime = dt.toISOString();
    dbUpdates.meeting_note = meetingInfo.note?.trim() || null;
    dbUpdates.meeting_reminder_sent = false;
  }

  const { error: updateError } = await supabase
    .from("leads")
    .update(dbUpdates)
    .eq("id", leadId);

  if (updateError) {
    return { error: updateError.message };
  }

  try {
    await writeLeadAuditEntries(supabase, {
      leadId,
      userId: profile.id,
      changes: [
        {
          field: "stage",
          oldValue: oldStage,
          newValue: newStage,
        },
      ],
    });
  } catch (err) {
    const rollback: Record<string, unknown> = { stage: oldStage };
    if (newStage === "meeting") {
      rollback.meeting_datetime = null;
      rollback.meeting_note = null;
    }
    await supabase.from("leads").update(rollback).eq("id", leadId);
    return {
      error: err instanceof Error ? err.message : "Failed to write audit.",
    };
  }

  revalidatePath("/crm");
  revalidatePath(`/crm/${leadId}`);

  const stageChangeMessage =
    newStage === "meeting" && meetingInfo
      ? `${profile.name} scheduled a meeting for lead "${lead.business_name}" on ${new Date(meetingInfo.datetime).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.`
      : `${profile.name} updated the stage of lead "${lead.business_name}" from "${oldStage}" to "${newStage}".`;

  // Whoever didn't make the change gets notified (the assignee, if someone
  // else moved their lead).
  if (lead.assigned_to !== profile.id) {
    await notifyUser({
      userId: lead.assigned_to,
      title: "Lead stage updated",
      message: stageChangeMessage,
      link: `/crm/${leadId}`,
      type: "lead_stage_change",
      referenceId: leadId,
    });
  }

  // Founder always gets a separate copy for visibility, unless the founder
  // is the one who made the change themself.
  if (profile.role !== "super_admin") {
    const { data: founders } = await supabase
      .from("users")
      .select("id")
      .eq("role", "super_admin")
      .eq("is_active", true);

    if (founders?.length) {
      await notifyUsers(
        founders.map((f) => f.id),
        {
          title: "Lead stage updated",
          message: stageChangeMessage,
          link: `/crm/${leadId}`,
          type: "lead_stage_change",
          referenceId: leadId,
        }
      );
    }
  }

  return { success: true };
}

/**
 * Reschedule the meeting for a lead that is already in the "meeting"
 * stage (same popup, reused). The previous meeting_datetime/note gets
 * pushed into meeting_history first, so multi-meeting leads keep a
 * trail ("2nd meeting", "3rd meeting", ...).
 */
export async function rescheduleMeetingAction(
  leadId: string,
  datetime: string,
  note: string
) {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const { data: lead, error: fetchError } = await supabase
    .from("leads")
    .select("id, stage, assigned_to, business_name, meeting_datetime, meeting_note, meeting_history")
    .eq("id", leadId)
    .single();

  if (fetchError || !lead) {
    return { error: "Lead not found." };
  }

  if (lead.stage !== "meeting") {
    return { error: "Lead is not in the Meeting stage." };
  }

  if (profile.role === "member" && lead.assigned_to !== profile.id) {
    return { error: "You can only update your own leads." };
  }

  const dt = new Date(datetime);
  if (isNaN(dt.getTime())) {
    return { error: "Invalid meeting date/time." };
  }

  const history: MeetingHistoryEntry[] = Array.isArray(lead.meeting_history)
    ? lead.meeting_history
    : [];

  // Only log the previous meeting into history if one actually existed.
  const nextHistory = lead.meeting_datetime
    ? [
        ...history,
        {
          datetime: lead.meeting_datetime,
          note: lead.meeting_note ?? null,
          logged_at: new Date().toISOString(),
        },
      ]
    : history;

  const { error: updateError } = await supabase
    .from("leads")
    .update({
      meeting_datetime: dt.toISOString(),
      meeting_note: note?.trim() || null,
      meeting_history: nextHistory,
      meeting_reminder_sent: false,
    })
    .eq("id", leadId);

  if (updateError) {
    return { error: updateError.message };
  }

  await writeLeadAuditEntries(supabase, {
    leadId,
    userId: profile.id,
    changes: [
      {
        field: "meeting_datetime",
        oldValue: lead.meeting_datetime,
        newValue: dt.toISOString(),
      },
    ],
  });

  revalidatePath("/crm");
  revalidatePath(`/crm/${leadId}`);

  const meetingNo = nextHistory.length + 1;
  const message = `${profile.name} rescheduled the meeting (#${meetingNo}) for lead "${lead.business_name}" to ${dt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.`;

  if (lead.assigned_to !== profile.id) {
    await notifyUser({
      userId: lead.assigned_to,
      title: "Meeting rescheduled",
      message,
      link: `/crm/${leadId}`,
      type: "lead_stage_change",
      referenceId: leadId,
    });
  }

  return { success: true };
}

export async function updateLeadAssigneeAction(
  leadId: string,
  newAssigneeId: string
) {
  const profile = await requireUserProfile();

  if (profile.role === "member") {
    return { error: "Only admins can reassign leads." };
  }

  const supabase = createClient();

  const { data: lead, error: fetchError } = await supabase
    .from("leads")
    .select("id, assigned_to, business_name, stage")
    .eq("id", leadId)
    .single();

  if (fetchError || !lead) {
    return { error: "Lead not found." };
  }

  const oldAssigneeId = lead.assigned_to as string;
  if (oldAssigneeId === newAssigneeId) {
    return { success: true };
  }

  if (!ASSIGNEE_CHANGEABLE_STAGES.includes(lead.stage as LeadStage)) {
    return {
      error: `Assignee is locked once a lead leaves ${LEAD_STAGE_LABELS.call_pending}. This lead is in "${LEAD_STAGE_LABELS[lead.stage as LeadStage]}".`,
    };
  }

  const assigneeError = await validateLeadAssignee(supabase, newAssigneeId);
  if (assigneeError) {
    return { error: assigneeError };
  }

  const { error: updateError } = await supabase
    .from("leads")
    .update({ assigned_to: newAssigneeId })
    .eq("id", leadId);

  if (updateError) {
    return { error: updateError.message };
  }

  try {
    await writeLeadAuditEntries(supabase, {
      leadId,
      userId: profile.id,
      changes: [
        {
          field: "assigned_to",
          oldValue: oldAssigneeId,
          newValue: newAssigneeId,
        },
      ],
    });
  } catch (err) {
    await supabase
      .from("leads")
      .update({ assigned_to: oldAssigneeId })
      .eq("id", leadId);
    return {
      error: err instanceof Error ? err.message : "Failed to write audit.",
    };
  }

  revalidatePath("/crm");
  revalidatePath(`/crm/${leadId}`);

  const reassignMessage = `${profile.name} assigned lead "${lead.business_name}" to you.`;

  if (newAssigneeId !== profile.id) {
    await notifyUser({
      userId: newAssigneeId,
      title: "Lead assigned to you",
      message: reassignMessage,
      link: `/crm/${leadId}`,
      type: "lead_reassigned",
      referenceId: leadId,
    });
  }

  if (profile.role !== "super_admin") {
    const { data: founders } = await supabase
      .from("users")
      .select("id")
      .eq("role", "super_admin")
      .eq("is_active", true);

    if (founders?.length) {
      await notifyUsers(
        founders.map((f) => f.id),
        {
          title: "Lead reassigned",
          message: `${profile.name} reassigned lead "${lead.business_name}".`,
          link: `/crm/${leadId}`,
          type: "lead_reassigned",
          referenceId: leadId,
        }
      );
    }
  }

  return { success: true };
}

export async function updateLeadAction(
  leadId: string,
  updates: Partial<Record<LeadEditableField, string | number | null>>
) {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const { data: lead, error: fetchError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (fetchError || !lead) {
    return { error: "Lead not found." };
  }

  if (profile.role === "member" && lead.assigned_to !== profile.id) {
    return { error: "You can only edit your own leads." };
  }

  if (
    "assigned_to" in updates &&
    updates.assigned_to !== lead.assigned_to &&
    !ASSIGNEE_CHANGEABLE_STAGES.includes(lead.stage as LeadStage)
  ) {
    return {
      error: `Assignee is locked once a lead leaves ${LEAD_STAGE_LABELS.call_pending}.`,
    };
  }

  // A lead can only carry stage="meeting" if it already has a meeting
  // date/time (set via the kanban popup or reschedule action). This
  // form has no date picker for it, so block the switch here — same
  // mandatory rule, no bypass route.
  if (
    "stage" in updates &&
    updates.stage === "meeting" &&
    lead.stage !== "meeting" &&
    !lead.meeting_datetime
  ) {
    return {
      error: "Set a meeting date/time from the CRM board's Move button to use this stage.",
    };
  }

  const dbUpdates: Record<string, unknown> = {};
  const changes: Array<{
    field: string;
    oldValue: string | null;
    newValue: string | null;
  }> = [];

  for (const [field, rawValue] of Object.entries(updates)) {
    const oldValue = serializeValue(lead[field as keyof typeof lead]);
    let newValue: string | null;

    if (field === "deal_value") {
      const num =
        rawValue === null || rawValue === "" ? null : Number(rawValue);
      dbUpdates.deal_value = num;
      newValue = serializeValue(num);
    } else if (field === "last_contact" || field === "next_followup") {
      const iso =
        rawValue === null || rawValue === ""
          ? null
          : new Date(String(rawValue)).toISOString();
      dbUpdates[field] = iso;
      newValue = serializeValue(iso);
    } else {
      const val =
        rawValue === null || rawValue === "" ? null : String(rawValue);
      dbUpdates[field] = val;
      newValue = serializeValue(val);
    }

    if (oldValue !== newValue) {
      changes.push({ field, oldValue, newValue });
    }
  }

  if (changes.length === 0) {
    return { success: true };
  }

  const { error: updateError } = await supabase
    .from("leads")
    .update(dbUpdates)
    .eq("id", leadId);

  if (updateError) {
    return { error: updateError.message };
  }

  try {
    await writeLeadAuditEntries(supabase, {
      leadId,
      userId: profile.id,
      changes,
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to write audit.",
    };
  }

  revalidatePath("/crm");
  revalidatePath(`/crm/${leadId}`);
  return { success: true };
}

/**
 * Bulk move: same permission rule as the single-lead move (members can only
 * move their own leads; admins/super_admins can move any). Every affected
 * assignee gets exactly ONE notification summarising how many of their leads
 * moved (never one notification per lead), and founders get one combined
 * summary too, unless the founder is the one who made the change.
 */
export async function bulkUpdateLeadStageAction(
  leadIds: string[],
  newStage: LeadStage
) {
  const profile = await requireUserProfile();

  if (!leadIds.length) {
    return { error: "No leads selected." };
  }
  if (!LEAD_STAGES.includes(newStage)) {
    return { error: "Invalid stage." };
  }

  const supabase = createClient();

  const { data: leads, error: fetchError } = await supabase
    .from("leads")
    .select("id, stage, assigned_to, business_name")
    .in("id", leadIds);

  if (fetchError || !leads?.length) {
    return { error: "Leads not found." };
  }

  if (profile.role === "member") {
    const notOwned = leads.some((l) => l.assigned_to !== profile.id);
    if (notOwned) {
      return { error: "You can only move your own leads." };
    }
  }

  const toUpdate = leads.filter((l) => l.stage !== newStage);
  if (!toUpdate.length) {
    return { success: true, moved: 0 };
  }

  const { error: updateError } = await supabase
    .from("leads")
    .update({ stage: newStage })
    .in(
      "id",
      toUpdate.map((l) => l.id)
    );

  if (updateError) {
    return { error: updateError.message };
  }

  try {
    await insertAuditRows(
      supabase,
      toUpdate.map((l) => ({
        lead_id: l.id,
        changed_by: profile.id,
        field_changed: "stage",
        old_value: l.stage,
        new_value: newStage,
      }))
    );
  } catch (err) {
    // best-effort rollback — each lead goes back to its own previous stage
    await Promise.all(
      toUpdate.map((l) =>
        supabase.from("leads").update({ stage: l.stage }).eq("id", l.id)
      )
    );
    return {
      error: err instanceof Error ? err.message : "Failed to write audit.",
    };
  }

  revalidatePath("/crm");

  const stageLabel = LEAD_STAGE_LABELS[newStage];

  // One combined notification per assignee (not one per lead).
  const byAssignee = new Map<string, number>();
  for (const l of toUpdate) {
    if (l.assigned_to === profile.id) continue; // actor doesn't need a notification about their own action
    byAssignee.set(l.assigned_to, (byAssignee.get(l.assigned_to) ?? 0) + 1);
  }

  await Promise.all(
    Array.from(byAssignee.entries()).map(([userId, count]) =>
      notifyUser({
        userId,
        title: "Leads moved",
        message: `${profile.name} moved ${count} of your lead${count !== 1 ? "s" : ""} to "${stageLabel}".`,
        link: "/crm",
        type: "lead_stage_change",
      })
    )
  );

  if (profile.role !== "super_admin") {
    const { data: founders } = await supabase
      .from("users")
      .select("id")
      .eq("role", "super_admin")
      .eq("is_active", true);

    if (founders?.length) {
      await notifyUsers(
        founders.map((f) => f.id),
        {
          title: "Leads moved (bulk)",
          message: `${profile.name} moved ${toUpdate.length} lead${toUpdate.length !== 1 ? "s" : ""} to "${stageLabel}".`,
          link: "/crm",
          type: "lead_stage_change",
        }
      );
    }
  }

  return { success: true, moved: toUpdate.length };
}

/**
 * Bulk reassign: admins/super_admins only, same as single-lead reassign.
 * The new assignee gets ONE combined notification for the whole batch, and
 * founders get one combined summary, unless the founder made the change.
 */
export async function bulkUpdateLeadAssigneeAction(
  leadIds: string[],
  newAssigneeId: string
) {
  const profile = await requireUserProfile();

  if (profile.role === "member") {
    return { error: "Only admins can reassign leads." };
  }
  if (!leadIds.length) {
    return { error: "No leads selected." };
  }

  const supabase = createClient();

  const assigneeError = await validateLeadAssignee(supabase, newAssigneeId);
  if (assigneeError) {
    return { error: assigneeError };
  }

  const { data: leads, error: fetchError } = await supabase
    .from("leads")
    .select("id, assigned_to, business_name, stage")
    .in("id", leadIds);

  if (fetchError || !leads?.length) {
    return { error: "Leads not found." };
  }

  const eligible = leads.filter((l) => l.assigned_to !== newAssigneeId);
  const locked = eligible.filter(
    (l) => !ASSIGNEE_CHANGEABLE_STAGES.includes(l.stage as LeadStage)
  );
  const toUpdate = eligible.filter(
    (l) => ASSIGNEE_CHANGEABLE_STAGES.includes(l.stage as LeadStage)
  );

  if (!toUpdate.length) {
    return {
      error: locked.length
        ? `Assignee is locked for ${locked.length} of the selected lead${locked.length !== 1 ? "s" : ""} — they've moved past Call Pending.`
        : undefined,
      success: true,
      reassigned: 0,
    };
  }

  const { error: updateError } = await supabase
    .from("leads")
    .update({ assigned_to: newAssigneeId })
    .in(
      "id",
      toUpdate.map((l) => l.id)
    );

  if (updateError) {
    return { error: updateError.message };
  }

  try {
    await insertAuditRows(
      supabase,
      toUpdate.map((l) => ({
        lead_id: l.id,
        changed_by: profile.id,
        field_changed: "assigned_to",
        old_value: l.assigned_to,
        new_value: newAssigneeId,
      }))
    );
  } catch (err) {
    await Promise.all(
      toUpdate.map((l) =>
        supabase
          .from("leads")
          .update({ assigned_to: l.assigned_to })
          .eq("id", l.id)
      )
    );
    return {
      error: err instanceof Error ? err.message : "Failed to write audit.",
    };
  }

  revalidatePath("/crm");

  if (newAssigneeId !== profile.id) {
    await notifyUser({
      userId: newAssigneeId,
      title: "Leads assigned to you",
      message: `${profile.name} assigned ${toUpdate.length} lead${toUpdate.length !== 1 ? "s" : ""} to you.`,
      link: "/crm",
      type: "lead_reassigned",
    });
  }

  if (profile.role !== "super_admin") {
    const { data: founders } = await supabase
      .from("users")
      .select("id")
      .eq("role", "super_admin")
      .eq("is_active", true);

    if (founders?.length) {
      await notifyUsers(
        founders.map((f) => f.id),
        {
          title: "Leads reassigned (bulk)",
          message: `${profile.name} reassigned ${toUpdate.length} lead${toUpdate.length !== 1 ? "s" : ""}.`,
          link: "/crm",
          type: "lead_reassigned",
        }
      );
    }
  }

  return {
    success: true,
    reassigned: toUpdate.length,
    lockedSkipped: locked.length || undefined,
  };
}

async function validateLeadAssignee(
  supabase: ReturnType<typeof createClient>,
  assignedTo: string
): Promise<string | null> {
  const { data: assignee, error } = await supabase
    .from("users")
    .select("id, is_active")
    .eq("id", assignedTo)
    .single();

  if (error || !assignee) {
    return "Assignee not found.";
  }

  if (!assignee.is_active) {
    return "Leads can only be assigned to active users.";
  }

  return null;
}

export async function getAssignableUsers() {
  const profile = await requireUserProfile();
  const supabase = createClient();

  if (profile.role === "member") {
    return [];
  }

  const { data } = await supabase
    .from("users")
    .select("id, name, email, role")
    .eq("is_active", true)
    .order("name");

  const users = data ?? [];

  if (!users.some((user) => user.id === profile.id)) {
    const { data: self } = await supabase
      .from("users")
      .select("id, name, email, role")
      .eq("id", profile.id)
      .eq("is_active", true)
      .single();

    if (self) {
      return [self, ...users].sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  return users;
}