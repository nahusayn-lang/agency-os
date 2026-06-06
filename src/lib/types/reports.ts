export interface Report {
  id: string;
  user_id: string;
  what_i_did_today: string;
  completed_work: string;
  pending_work: string;
  blockers: string;
  created_at: string;
  updated_at: string;
}

export interface ReportWithUser extends Report {
  user?: { id: string; name?: string; email?: string };
}
