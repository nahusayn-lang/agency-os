import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function AttendancePage() {
  const profile = await requireUserProfile();
  const supabase = createClient();
  const isMember = profile.role === "member";

  if (isMember) {
    const { data: rows } = await supabase.from("attendance").select("id, login_time, logout_time, status, date").eq("user_id", profile.id).order("date", { ascending: false }).limit(200);
    const entries = (rows ?? []) as Array<{
      id: string;
      login_time: string | null;
      logout_time: string | null;
      status: string;
      date: string;
    }>;

    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold">My Attendance</h1>
        <ul className="space-y-2">
          {entries.map((r) => (
            <li key={r.id} className="rounded border p-4">
              <div className="text-sm">Date: {r.date}</div>
              <div className="text-sm">Login: {r.login_time}</div>
              <div className="text-sm">Logout: {r.logout_time ?? "—"}</div>
              <div className="text-sm">Status: {r.status}</div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Admin / manager view: recent attendance across users
  const { data: rows } = await supabase.from("attendance").select("id, user_id, login_time, logout_time, status, date").order("date", { ascending: false }).limit(500);
  const entries = (rows ?? []) as Array<{
    id: string;
    user_id: string;
    login_time: string | null;
    logout_time: string | null;
    status: string;
    date: string;
  }>;

  const userIds = Array.from(new Set(entries.map((e) => e.user_id)));
  const { data: users } = await supabase.from("users").select("id, name").in("id", userIds);
  const userMap = new Map((users ?? []).map((u: { id: string; name: string }) => [u.id, u.name]));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Attendance</h1>
      <ul className="space-y-2">
        {entries.map((r) => (
          <li key={r.id} className="rounded border p-4">
            <div className="text-sm font-medium">{userMap.get(r.user_id) ?? r.user_id}</div>
            <div className="text-sm">Date: {r.date}</div>
            <div className="text-sm">Login: {r.login_time}</div>
            <div className="text-sm">Logout: {r.logout_time ?? "—"}</div>
            <div className="text-sm">Status: {r.status}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
