import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getLoginAttendanceStatus,
  getTodayDateString,
  isEarlyExit,
} from "@/lib/auth/attendance";
import type { AttendanceStatus } from "@/lib/types/database";

interface LoginAttendanceResult {
  attendanceId: string;
  status: Extract<AttendanceStatus, "present" | "late">;
}

export async function recordLoginAttendance(
  userId: string,
  shiftStart: string,
  loginTime: Date = new Date()
): Promise<LoginAttendanceResult> {
  const admin = createAdminClient();
  const status = getLoginAttendanceStatus(shiftStart, loginTime);
  const date = getTodayDateString(loginTime);

  const { data, error } = await admin
    .from("attendance")
    .insert({
      user_id: userId,
      login_time: loginTime.toISOString(),
      status,
      date,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to record login attendance: ${error?.message ?? "unknown error"}`
    );
  }

  return { attendanceId: data.id, status };
}

export async function recordLogoutAttendance(
  userId: string,
  shiftEnd: string,
  logoutTime: Date = new Date()
): Promise<string | null> {
  const admin = createAdminClient();
  const date = getTodayDateString(logoutTime);

  const { data: attendance, error: fetchError } = await admin
    .from("attendance")
    .select("id, status")
    .eq("user_id", userId)
    .eq("date", date)
    .is("logout_time", null)
    .order("login_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    throw new Error(
      `Failed to fetch attendance for logout: ${fetchError.message}`
    );
  }

  if (!attendance) {
    return null;
  }

  const updates: {
    logout_time: string;
    status?: AttendanceStatus;
  } = {
    logout_time: logoutTime.toISOString(),
  };

  if (isEarlyExit(shiftEnd, logoutTime)) {
    updates.status = "early_exit";
  }

  const { error: updateError } = await admin
    .from("attendance")
    .update(updates)
    .eq("id", attendance.id);

  if (updateError) {
    throw new Error(
      `Failed to record logout attendance: ${updateError.message}`
    );
  }

  return attendance.id;
}
