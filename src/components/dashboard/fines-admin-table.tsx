"use client";

import { useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface AdminFineRow {
  id: string;
  user_name: string;
  amount: number;
  status: "pending" | "submitted" | "paid" | "waived";
  deadline: string;
  proof_url: string | null;
  payment_comment: string | null;
}

function statusBadgeClass(status: AdminFineRow["status"], isOverdue: boolean) {
  if (status === "paid") return "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30";
  if (status === "waived") return "bg-muted text-muted-foreground border border-border";
  if (status === "submitted") return "bg-sky-500/10 text-sky-500 border border-sky-500/30";
  if (isOverdue) return "bg-destructive/10 text-destructive border border-destructive/30";
  return "bg-amber-500/10 text-amber-500 border border-amber-500/30";
}

function statusLabel(status: AdminFineRow["status"], isOverdue: boolean) {
  if (status === "pending" && isOverdue) return "overdue";
  if (status === "submitted") return "awaiting confirmation";
  return status;
}

/** Founder sees full controls; admin/manager get a read-only list. */
export function FinesAdminTable({
  fines,
  isSuperAdmin,
}: {
  fines: AdminFineRow[];
  isSuperAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Employee fines</CardTitle>
      </CardHeader>
      <CardContent>
        {fines.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">Koi fine nahi hai.</p>
        )}

        <div className="space-y-2">
          {fines.map((fine) => {
            const isOverdue = fine.status === "pending" && fine.deadline < today;
            return (
              <div key={fine.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-sm">{fine.user_name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadgeClass(fine.status, isOverdue)}`}>
                    {statusLabel(fine.status, isOverdue)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="text-foreground font-medium text-sm">₹{fine.amount}</span>
                  <span>Deadline: {fine.deadline}</span>
                  {fine.proof_url && (
                    <a href={fine.proof_url} target="_blank" rel="noreferrer" className="text-primary underline">
                      Screenshot dekho
                    </a>
                  )}
                </div>

                {fine.payment_comment && (
                  <p className="text-xs text-muted-foreground italic">&quot;{fine.payment_comment}&quot;</p>
                )}

                {isSuperAdmin && fine.status === "submitted" && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      disabled={pending}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => act(fine.id, "paid")}
                    >
                      Confirm paid
                    </Button>
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => act(fine.id, "reject")}>
                      Reject proof
                    </Button>
                  </div>
                )}

                {isSuperAdmin && fine.status === "pending" && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" disabled={pending} onClick={() => act(fine.id, "paid")}>
                      Mark paid
                    </Button>
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(fine.id, "waived")}>
                      Waive
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}