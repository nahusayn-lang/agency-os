import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  present:    { label: "Present",    dot: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  late:       { label: "Late",       dot: "bg-yellow-500",  badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  early_exit: { label: "Early Exit", dot: "bg-orange-500",  badge: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  absent:     { label: "Absent",     dot: "bg-red-500",     badge: "bg-red-500/10 text-red-400 border-red-500/20" },
};

const PAST_PRESENT_CONFIG = {
  dot: "bg-[#d97757]",
  badge: "bg-[#d97757]/10 text-[#d97757] border-[#d97757]/20",
};

function getStatusConfig(status: string, isToday: boolean, hasCheckin: boolean = false) {
  const s = STATUS_CONFIG[status] ?? { label: status, dot: "bg-muted", badge: "bg-muted text-muted-foreground border-border" };
  if (status === "present" && !isToday) {
    return { ...s, dot: PAST_PRESENT_CONFIG.dot, badge: PAST_PRESENT_CONFIG.badge };
  }
  // Checked in after shift-end (recovery check-in) — still counts as
  // "absent" for fines/strikes, but the label shouldn't say "Absent"
  // since the person did show up, just late.
  if (status === "absent" && hasCheckin) {
    return { ...s, label: "Post-Shift" };
  }
  return s;
}

function fmtTime(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString([], {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function calcDuration(checkin: string | null, checkout: string | null): string {
  if (!checkin || !checkout) return "—";
  const ms = new Date(checkout).getTime() - new Date(checkin).getTime();
  if (ms <= 0) return "—";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function isToday(dateStr: string): boolean {
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

export default async function AttendancePage() {
  const profile = await requireUserProfile();
  const supabase = createClient();
  const admin = createAdminClient();
  const isMember = profile.role === "member";

  if (isMember) {
    const { data: rows } = await supabase
      .from("attendance")
      .select("id, checkin_time, checkout_time, login_time, logout_time, status, date")
      .eq("user_id", profile.id)
      .order("date", { ascending: false })
      .limit(60);

    const entries = (rows ?? []) as Array<{
      id: string;
      checkin_time: string | null;
      checkout_time: string | null;
      login_time: string | null;
      logout_time: string | null;
      status: string;
      date: string;
    }>;

    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Attendance</h1>
          <p className="text-sm text-muted-foreground mt-1">Your last {entries.length} records</p>
        </div>

        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No attendance records found.
          </div>
        ) : (
          <ul className="space-y-3">
            {entries.map((r) => {
              const checkin = r.checkin_time ?? r.login_time;
              const checkout = r.checkout_time ?? r.logout_time;
             const today = isToday(r.date);
              const s = getStatusConfig(r.status, today, !!checkin);

              return (
                <li key={r.id} className={`rounded-xl border p-4 ${today ? "border-emerald-500/30 bg-emerald-950/10" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${s.dot}`} />
                        <span className="font-medium text-sm">{fmtDate(r.date)}</span>
                        {today && <span className="text-xs text-emerald-400 font-medium">Today</span>}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground pl-4">
                        <span>Check-in <span className="text-foreground font-medium">{fmtTime(checkin)}</span></span>
                        <span>Check-out <span className="text-foreground font-medium">{fmtTime(checkout)}</span></span>
                        <span>Duration <span className="text-foreground font-medium">{calcDuration(checkin, checkout)}</span></span>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 ${s.badge}`}>
                      {s.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromDate = thirtyDaysAgo.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  const { data: rows } = await admin
    .from("attendance")
    .select("id, user_id, checkin_time, checkout_time, login_time, logout_time, status, date")
    .gte("date", fromDate)
    .order("date", { ascending: false })
    .limit(1000);

  const entries = (rows ?? []) as Array<{
    id: string;
    user_id: string;
    checkin_time: string | null;
    checkout_time: string | null;
    login_time: string | null;
    logout_time: string | null;
    status: string;
    date: string;
  }>;

  const { data: allUsers } = await admin
    .from("users")
    .select("id, name")
    .eq("is_active", true)
    .in("role", ["member", "admin", "super_admin"]);

  const userMap = new Map((allUsers ?? []).map((u: { id: string; name: string }) => [u.id, u.name]));

  const byDate = new Map<string, typeof entries>();
  for (const e of entries) {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date)!.push(e);
  }

  const statusOrder = ["present", "late", "early_exit", "absent"];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
        <p className="text-sm text-muted-foreground mt-1">Last 30 days — all team members</p>
      </div>

      {[...byDate.entries()].map(([date, dayEntries]) => {
        const today = isToday(date);
        const sorted = [...dayEntries].sort(
          (a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)
        );

        const presentCount = dayEntries.filter((e) => e.status !== "absent").length;
        const lateCount = dayEntries.filter((e) => e.status === "late").length;
        const absentCount = dayEntries.filter((e) => e.status === "absent").length;

        return (
          <div key={date} className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-semibold text-base">{fmtDate(date)}</h2>
                {today && (
                  <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                    Today
                  </span>
                )}
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground shrink-0">
                <span className="text-emerald-400">{presentCount} present</span>
                {lateCount > 0 && <span className="text-yellow-400">{lateCount} late</span>}
                {absentCount > 0 && <span className="text-red-400">{absentCount} absent</span>}
              </div>
            </div>

            <ul className="divide-y divide-border rounded-xl border overflow-hidden">
              {sorted.map((r) => {
           const checkin = r.checkin_time ?? r.login_time;
                const checkout = r.checkout_time ?? r.logout_time;
                const s = getStatusConfig(r.status, today, !!checkin);

                return (
                  <li key={r.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${s.dot}`} />
                        <span className="font-medium text-sm truncate">
                          {userMap.get(r.user_id) ?? "Unknown"}
                        </span>
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border shrink-0 ${s.badge}`}>
                        {s.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1.5 pl-4">
                      <span>In <span className="text-foreground font-medium">{fmtTime(checkin)}</span></span>
                      <span>Out <span className="text-foreground font-medium">{fmtTime(checkout)}</span></span>
                      <span className="text-foreground font-medium">{calcDuration(checkin, checkout)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}