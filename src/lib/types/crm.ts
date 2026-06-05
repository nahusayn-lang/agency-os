export type LeadStage =
  | "new_lead"
  | "call_pending"
  | "interested"
  | "negotiation"
  | "deal_won"
  | "deal_lost";

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
  "negotiation",
  "deal_won",
  "deal_lost",
];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new_lead: "New Lead",
  call_pending: "Call Pending",
  interested: "Interested",
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
