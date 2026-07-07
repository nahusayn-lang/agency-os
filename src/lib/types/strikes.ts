export type StrikeReason = "late_checkin" | "missed_checkout" | "fine_deadline_missed";
export type FineStatus = "pending" | "paid" | "waived";
export type CannotCompleteStatus = "auto_accepted" | "pending_approval" | "approved" | "rejected";

export interface Strike {
  id: string;
  user_id: string;
  reason: StrikeReason;
  source_id: string | null;
  fine_id: string | null;
  is_removed: boolean;
  removed_by: string | null;
  removed_reason: string | null;
  removed_at: string | null;
  created_at: string;
}

export interface Fine {
  id: string;
  user_id: string;
  amount: number;
  strikes_count: number;
  status: FineStatus;
  deadline: string;
  proof_url: string | null;
  dispute_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface GraceUsage {
  id: string;
  user_id: string;
  week_start: string;
  used_count: number;
}

export interface CannotCompleteUsage {
  id: string;
  user_id: string;
  task_id: string;
  date: string;
  reason: string;
  status: CannotCompleteStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}