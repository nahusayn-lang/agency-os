export type UserRole = "super_admin" | "admin" | "member";

export type AttendanceStatus =
  | "present"
  | "late"
  | "early_exit"
  | "absent";

export type AuditAction = "login" | "logout";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  shift_start: string;
  shift_end: string;
  is_active: boolean;
  created_at: string;
}

export interface Attendance {
  id: string;
  user_id: string;
  login_time: string | null;
  logout_time: string | null;
  status: AttendanceStatus;
  override_reason: string | null;
  overridden_by: string | null;
  date: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  reason: string | null;
  created_at: string;
}

export interface GodModeOverride {
  id: string;
  super_admin_id: string;
  action: string;
  target_entity: string;
  reason: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, "created_at"> & { created_at?: string };
        Update: Partial<Omit<User, "id">>;
      };
      attendance: {
        Row: Attendance;
        Insert: Omit<Attendance, "id"> & { id?: string };
        Update: Partial<Omit<Attendance, "id" | "user_id">>;
      };
      audit_log: {
        Row: AuditLog;
        Insert: Omit<AuditLog, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: never;
      };
      god_mode_overrides: {
        Row: GodModeOverride;
        Insert: Omit<GodModeOverride, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<GodModeOverride, "id">>;
      };
      performance_scores: {
        Row: {
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
        };
        Insert: never;
        Update: never;
      };
      founder_weekly_commitments: {
        Row: {
          id: string;
          week_start: string;
          commitment_text: string;
          updated_by: string;
          updated_at: string;
        };
        Insert: {
          week_start: string;
          commitment_text: string;
          updated_by: string;
          updated_at?: string;
        };
        Update: Partial<{
          commitment_text: string;
          updated_by: string;
          updated_at: string;
        }>;
      };
    };
  };
}
