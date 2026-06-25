import type { AttendanceStatus } from "@/lib/types/database";

function parseTimeOnDate(time: string, reference: Date): Date {
  const [hours, minutes, seconds] = time.split(":").map(Number);
  const result = new Date(reference);
  result.setHours(hours, minutes, seconds ?? 0, 0);
  return result;
}

export function getLoginAttendanceStatus(
  shiftStart: string,
  loginTime: Date
): Extract<AttendanceStatus, "present" | "late"> {
  const shiftStartToday = parseTimeOnDate(shiftStart, loginTime);
  return loginTime > shiftStartToday ? "late" : "present";
}

export function isEarlyExit(shiftEnd: string, logoutTime: Date): boolean {
  const shiftEndToday = parseTimeOnDate(shiftEnd, logoutTime);
  const earlyThreshold = new Date(shiftEndToday.getTime() - 15 * 60 * 1000);
  return logoutTime < earlyThreshold;
}

/** Local calendar date (YYYY-MM-DD) for attendance grouping. Uses IST to match India timezone. */
export function getTodayDateString(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}