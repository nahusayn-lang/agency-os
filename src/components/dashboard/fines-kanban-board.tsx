"use client";

import { useMemo, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface FineKanbanRow {
  id: string;
  user_name: string;
  amount: number;
  status: "pending" | "submitted" | "paid" | "waived";
  deadline: string;
  proof_url: string | null;
  payment_comment: string | null;
  category: string;
}

const COLUMNS: { key: FineKanbanRow["status"]; label: string; dot: string }[] = [
  { key: "pending", label: "Pending", dot: "bg-amber-500" },
  { key: "submitted", label: "Submitted", dot: "bg-sky-500" },
  { key: "paid", label: "Paid", dot: "bg-emerald-500" },
  { key: "waived", label: "Waived", dot: "bg-muted-foreground" },
];

const CATEGORY_LABELS: Record<string, string> = {
  late_checkin: "Late Check-in",
  missed_checkout: "Missed Checkout",
  no_checkin: "Absent",
  fine_deadline_missed: "Deadline Missed",
  leave_rejected: "Leave Rejected",
  uncategorized: "Other",
};

/** Founder-only controls; admin/manager get read-only cards. */
export function FinesKanbanBoard({
  fines,
  isSuperAdmin,
}: {
  fines: FineKanbanRow[];
  isSuperAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");

  const employeeNames = useMemo(
    () => Array.from(new Set(fines.map((f) => f.user_name))).sort(),
    [fines]
  );

  const visibleFines = useMemo(
    () => (employeeFilter === "all" ? fines : fines.filter((f) => f.user_name === employeeFilter)),
    [fines, employeeFilter]
  );

  function act(fineId: string, action: "paid" | "waived" | "reject") {
    startTransition(async () => {
      await fetch("/api/admin/fines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fineId, action }),
      });
      window.location.reload();
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-white/70">Fines</h3>
        <select
          className="text-xs rounded border px-2 py-1 bg-background"
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
        >
          <option value="all">All employees</option>
          {employeeNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const colFines = visibleFines.filter((f) => f.status === col.key);
          return (
            <Card key={col.key} className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  {col.label}
                  <span className="text-xs text-muted-foreground font-normal ml-auto">
                    {colFines.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 flex-1">
                {colFines.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">Khaali hai.</p>
                )}
                {colFines.map((fine) => {
                  const isOverdue = fine.status === "pending" && fine.deadline < today;
                  return (
                    <div key={fine.id} className="rounded-lg border p-2.5 space-y-1.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{fine.user_name}</span>
                        <span className="text-sm font-semibold">₹{fine.amount}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/60 border border-white/10">
                          {CATEGORY_LABELS[fine.category] ?? fine.category}
                        </span>
                        {isOverdue && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/30">
                            overdue
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">Deadline: {fine.deadline}</p>
                      {fine.proof_url && (
                        <a
                          href={fine.proof_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-primary underline block"
                        >
                          Screenshot dekho
                        </a>
                      )}
                      {fine.payment_comment && (
                        <p className="text-[11px] text-muted-foreground italic">
                          &quot;{fine.payment_comment}&quot;
                        </p>
                      )}

                      {isSuperAdmin && fine.status === "submitted" && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <Button
                            size="sm"
                            disabled={pending}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs"
                            onClick={() => act(fine.id, "paid")}
                          >
                            Confirm paid
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            className="h-7 text-xs"
                            onClick={() => act(fine.id, "reject")}
                          >
                            Reject
                          </Button>
                        </div>
                      )}

                      {isSuperAdmin && fine.status === "pending" && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <Button
                            size="sm"
                            disabled={pending}
                            className="h-7 text-xs"
                            onClick={() => act(fine.id, "paid")}
                          >
                            Mark paid
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            className="h-7 text-xs"
                            onClick={() => act(fine.id, "waived")}
                          >
                            Waive
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}