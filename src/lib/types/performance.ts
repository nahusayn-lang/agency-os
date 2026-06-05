export interface PerformanceScore {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  task_score: number;
  attendance_score: number;
  lead_score: number;
  report_score: number;
  total_score: number;
  created_at: string;
}

export interface PerformanceScoreOverridePayload {
  task_score: number;
  attendance_score: number;
  lead_score: number;
  report_score: number;
  total_score: number;
  note?: string;
}

export const PERFORMANCE_OVERRIDE_ACTION = "override_performance_score";
