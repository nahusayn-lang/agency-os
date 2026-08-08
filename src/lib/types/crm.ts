export type LeadStage =
  | "new_lead"
  | "call_pending"
  | "interested"
  | "meeting"
  | "negotiation"
  | "deal_won"
  | "deal_lost";

// Assignee can only be changed while a lead is in one of these stages.
// From "interested" onward it's permanent (enforced again at the DB
// level by the lead_assignee_lock trigger, see migration 026).
export const ASSIGNEE_CHANGEABLE_STAGES: LeadStage[] = ["new_lead", "call_pending"];

export interface MeetingHistoryEntry {
  datetime: string;
  note: string | null;
  logged_at: string;
}

export interface Lead {
  id: string;
  name: string;
  business_name: string | null;
  phone: string | null;
  email: string | null;
  stage: LeadStage;
  deal_value: number | null;
  assigned_to: string;
  notes: string | null;
  last_contact: string | null;
  next_followup: string | null;
  meeting_datetime: string | null;
  meeting_note: string | null;
  meeting_history: MeetingHistoryEntry[];
  created_at: string;
}

export interface LeadAudit {
  id: string;
  lead_id: string;
  changed_by: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

export interface LeadWithAssignee extends Lead {
  assignee: { id: string; name: string; email: string };
}

export const LEAD_STAGES: LeadStage[] = [
  "new_lead",
  "call_pending",
  "interested",
  "meeting",
  "negotiation",
  "deal_won",
  "deal_lost",
];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new_lead: "New Lead",
  call_pending: "Call Pending",
  interested: "Interested",
  meeting: "Meeting",
  negotiation: "Negotiation",
  deal_won: "Deal Won",
  deal_lost: "Deal Lost",
};

export const LEAD_EDITABLE_FIELDS = [
  "name",
  "business_name",
  "phone",
  "email",
  "stage",
  "deal_value",
  "assigned_to",
  "notes",
  "last_contact",
  "next_followup",
] as const;

export type LeadEditableField = (typeof LEAD_EDITABLE_FIELDS)[number];