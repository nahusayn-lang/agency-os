import type { AttendanceStatus } from "@/lib/types/database";

/**
 * Builds the absolute instant for a given "HH:MM:SS" wall-clock time, ON THE
 * IST CALENDAR DATE of `reference` — regardless of the server's own local
 * timezone (Vercel runs UTC by default, and setHours() previously set the
 * hour in server-local time, silently shifting every shift_start/shift_end
 * comparison by 5:30 hours). This is timezone-safe.
 */
function parseTimeOnDate(time: string, reference: Date): Date {
  const istDateStr = reference.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // "YYYY-MM-DD"
  return new Date(`${istDateStr}T${time}+05:30`);
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