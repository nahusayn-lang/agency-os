import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications/notify";

export async function getSundayOffSetting(): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("attendance_settings")
    .select("sunday_off")
    .eq("id", 1)
    .maybeSingle();
  return data?.sunday_off ?? true;
}

/** Super_admin-only: toggles the global Sunday-off setting and notifies everyone. */
export async function setSundayOffSetting(sundayOff: boolean, updatedBy: string): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin
    .from("attendance_settings")
    .upsert({ id: 1, sunday_off: sundayOff, updated_by: updatedBy, updated_at: new Date().toISOString() });

  if (error) throw new Error(`Failed to update Sunday-off setting: ${error.message}`);

  const { data: users } = await admin.from("users").select("id").eq("is_active", true);

  const title = sundayOff ? "Sunday is now off" : "Sunday is now a working day";
  const message = sundayOff
    ? "Sunday has been set as a weekly off. No check-in required."
    : "Sunday has been made a working day this time — check-in is required as usual.";

  for (const u of users ?? []) {
    await notifyUser({ userId: u.id, title, message, link: "/attendance", type: "attendance_setting" });
  }
}

export interface HolidayRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

export async function listHolidays(): Promise<HolidayRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("holidays")
    .select("id, name, start_date, end_date")
    .order("start_date", { ascending: true });
  return data ?? [];
}

export async function addHoliday(
  name: string,
  startDate: string,
  endDate: string,
  createdBy: string
): Promise<void> {
  if (!name.trim()) throw new Error("Holiday name is required.");
  if (!startDate || !endDate) throw new Error("Start and end date are required.");
  if (endDate < startDate) throw new Error("End date cannot be before start date.");

  const admin = createAdminClient();
  const { error } = await admin
    .from("holidays")
    .insert({ name: name.trim(), start_date: startDate, end_date: endDate, created_by: createdBy });

  if (error) throw new Error(`Failed to add holiday: ${error.message}`);
}

export async function deleteHoliday(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("holidays").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete holiday: ${error.message}`);
}