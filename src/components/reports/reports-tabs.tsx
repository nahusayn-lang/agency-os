"use client";

import { useState, type ReactNode } from "react";
import { ReportAccordion } from "@/components/reports/report-accordion";
import type { ReportWithUser } from "@/lib/types/reports";

interface ReportsTabsProps {
  createForm: ReactNode;
  myReports: ReportWithUser[];
  teamReports: ReportWithUser[] | null;
}

export function ReportsTabs({ createForm, myReports, teamReports }: ReportsTabsProps) {
  const showTeamTab = teamReports !== null;
  const [tab, setTab] = useState<"mine" | "team">("mine");

  return (
    <div className="space-y-6">
      {showTeamTab && (
        <div className="inline-flex w-fit gap-1 rounded-lg border bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setTab("mine")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === "mine" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            My Reports
          </button>
          <button
            type="button"
            onClick={() => setTab("team")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === "team" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Team Reports
          </button>
        </div>
      )}

      {tab === "mine" ? (
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1">{createForm}</div>
          <div className="lg:col-span-2">
            <ReportAccordion reports={myReports} variant="mine" emptyLabel="No reports yet." />
          </div>
        </div>
      ) : (
        <ReportAccordion reports={teamReports ?? []} variant="team" emptyLabel="No reports found." />
      )}
    </div>
  );
}