export interface WeeklyTarget {
  id: string;
  user_id: string;
  admin_id: string;
  target_name: string;
  completion_percentage: number;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeeklyTargetWithUsers extends WeeklyTarget {
  user?: { id: string; name?: string; email?: string };
  admin?: { id: string; name?: string; email?: string };
}
