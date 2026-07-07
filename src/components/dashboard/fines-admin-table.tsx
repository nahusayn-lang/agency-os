"use client";

import { useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface AdminFineRow {
  id: string;
  user_name: string;
  amount: number;
  status: "pending" | "paid" | "waived";
  deadline: string;
  proof_url: string | null;
  dispute_reason: string | null;
}

function statusBadge(status: AdminFineRow["status"], isOverdue: boolean) {
  if (status === "paid") return "bg-accent text-accent-foreground";
  if (status === "waived") return "bg-muted text-muted-foreground";
  if (isOverdue) return "bg-destructive/15 text-destructive";
  return "bg-yellow-500/10 text-yellow-600 border border-yellow-500/40";
}

/** Only render for super_admin — pass isSuperAdmin from the server page. */
export function FinesAdminTable({
  fines,
  isSuperAdmin,
}: {
  fines: AdminFineRow[];
  isSuperAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  function act(fineId: string, action: "paid" | "waived") {
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
        <CardTitle className="text-base">Employee Fines</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2 pr-4">Employee</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Deadline</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Proof</th>
                {isSuperAdmin && <th className="py-2 pr-4">Action</th>}
              </tr>
            </thead>
            <tbody>
              {fines.map((fine) => {
                const isOverdue = fine.status === "pending" && fine.deadline < today;
                return (
                  <tr key={fine.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{fine.user_name}</td>
                    <td className="py-2 pr-4">₹{fine.amount}</td>
                    <td className="py-2 pr-4">{fine.deadline}</td>
                    <td className="py-2 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge(fine.status, isOverdue)}`}>
                        {fine.status === "pending" && isOverdue ? "overdue" : fine.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      {fine.proof_url ? (
                        <a href={fine.proof_url} target="_blank" rel="noreferrer" className="text-blue-500 underline text-xs">
                          view
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    {isSuperAdmin && (
                      <td className="py-2 pr-4">
                        {fine.status === "pending" && (
                          <div className="flex gap-2">
                            <Button size="sm" disabled={pending} onClick={() => act(fine.id, "paid")}>
                              Mark Paid
                            </Button>
                            <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(fine.id, "waived")}>
                              Waive
                            </Button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {fines.length === 0 && (
                <tr>
                  <td colSpan={isSuperAdmin ? 6 : 5} className="py-4 text-center text-muted-foreground">
                    Koi fine nahi hai.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}