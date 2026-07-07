"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface FineWalletItem {
  id: string;
  amount: number;
  status: "pending" | "paid" | "waived";
  deadline: string;
  proof_url: string | null;
  dispute_reason: string | null;
}

function statusStyles(status: FineWalletItem["status"], isOverdue: boolean) {
  if (status === "paid") return "bg-accent text-accent-foreground";
  if (status === "waived") return "bg-muted text-muted-foreground";
  if (isOverdue) return "bg-destructive/15 text-destructive";
  return "bg-popover text-popover-foreground border border-yellow-500/40 text-yellow-600";
}

export function FineWalletWidget({ fines }: { fines: FineWalletItem[] }) {
  const [pending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const [proofUrl, setProofUrl] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const totalPending = fines
    .filter((f) => f.status === "pending")
    .reduce((sum, f) => sum + Number(f.amount), 0);

  function submitDispute(fineId: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/fines", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fineId, proofUrl, disputeReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to submit.");
        return;
      }
      setOpenId(null);
      setProofUrl("");
      setDisputeReason("");
      window.location.reload();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>Fine Wallet</span>
          {totalPending > 0 && (
            <span className="text-destructive text-sm font-semibold">₹{totalPending} pending</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {fines.length === 0 && (
          <p className="text-sm text-muted-foreground">Koi fine nahi hai. 🎉</p>
        )}

        {fines.map((fine) => {
          const isOverdue = fine.status === "pending" && fine.deadline < today;
          return (
            <div key={fine.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">₹{fine.amount}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusStyles(fine.status, isOverdue)}`}>
                  {fine.status === "pending" && isOverdue ? "overdue" : fine.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Deadline: {fine.deadline}</p>

              {fine.status === "pending" && (
                <>
                  {openId === fine.id ? (
                    <div className="space-y-2">
                      <input
                        className="w-full text-sm rounded border px-2 py-1 bg-background"
                        placeholder="Proof screenshot URL"
                        value={proofUrl}
                        onChange={(e) => setProofUrl(e.target.value)}
                      />
                      <textarea
                        className="w-full text-sm rounded border px-2 py-1 bg-background"
                        placeholder="Reason / dispute note"
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value)}
                      />
                      {error && <p className="text-xs text-destructive">{error}</p>}
                      <div className="flex gap-2">
                        <Button size="sm" disabled={pending} onClick={() => submitDispute(fine.id)}>
                          Submit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setOpenId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setOpenId(fine.id)}>
                      Proof / Dispute daalo
                    </Button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}