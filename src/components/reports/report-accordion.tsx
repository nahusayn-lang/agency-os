"use client";

import { useMemo, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ROLE_LABEL, type ReportUserRole, type ReportWithUser } from "@/lib/types/reports";

interface ReportAccordionProps {
  reports: ReportWithUser[];
  variant: "mine" | "team";
  emptyLabel: string;
}

const ROLE_BADGE_STYLE: Record<ReportUserRole, string> = {
  member: "bg-sky-500/10 text-sky-500 border-sky-500/20",
  admin: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  super_admin: "bg-primary/10 text-primary border-primary/20",
};

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtTime(d: string): string {
  return new Date(d).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function dayKey(d: string): string {
  return new Date(d).toDateString();
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function ReportAccordion({ reports, variant, emptyLabel }: ReportAccordionProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const byDate = new Map<string, ReportWithUser[]>();
    for (const r of reports) {
      const key = dayKey(r.created_at);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(r);
    }
    return [...byDate.entries()].sort(
      (a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()
    );
  }, [reports]);

  if (reports.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-center text-sm text-muted-foreground">{emptyLabel}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(([key, dayReports]) => {
        const today = key === new Date().toDateString();
        return (
          <div key={key} className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <h3 className="text-sm font-semibold">{fmtDate(dayReports[0].created_at)}</h3>
              {today && (
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
                  Today
                </span>
              )}
        
            </div>

            <div className="space-y-2">
              {dayReports.map((report) => {
                const isOpen = openId === report.id;
                const roleKey = (report.user?.role ?? "member") as ReportUserRole;
                const name = report.user?.name || "Unknown";

                return (
                  <Card key={report.id} className={`overflow-hidden p-0 ${isOpen ? "border-primary/40" : ""}`}>
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : report.id)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                      aria-expanded={isOpen}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {variant === "team" && (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                            {initials(name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {variant === "team" && <span className="text-sm font-medium">{name}</span>}
                          
                            {variant === "mine" && (
                              <span className="text-sm font-medium">{fmtTime(report.created_at)}</span>
                            )}
                          </div>
                          {!isOpen && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {report.what_i_did_today}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {variant === "team" && (
                          <span className="text-xs text-muted-foreground">{fmtTime(report.created_at)}</span>
                        )}
                        <ChevronDownIcon
                          className={`size-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180 text-primary" : ""}`}
                        />
                      </div>
                    </button>

                    {isOpen && (
                      <div className="space-y-4 border-t px-4 py-4">
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            What {variant === "mine" ? "I did" : "they did"} today
                          </h4>
                          <p className="mt-1 text-sm">{report.what_i_did_today}</p>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Completed work</h4>
                          <p className="mt-1 text-sm">{report.completed_work}</p>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pending work</h4>
                          <p className="mt-1 text-sm">{report.pending_work}</p>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Blockers</h4>
                          <p className="mt-1 text-sm">{report.blockers}</p>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}