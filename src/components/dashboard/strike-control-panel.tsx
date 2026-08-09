"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export interface StrikeRow {
  id: string;
  user_name: string;
  reason: string;
  is_removed: boolean;
  created_at: string;
}

/**
 * Founder-only, private control. The parent server page must gate rendering
 * this component behind `profile.role === "super_admin"` — it must never be
 * imported or rendered for admin/member roles.
 */
export function StrikeControlPanel({ strikes, fineAmount }: { strikes: StrikeRow[]; fineAmount: number }) {
  const [pending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [amountInput, setAmountInput] = useState(String(fineAmount));
  const [amountPending, startAmountTransition] = useTransition();
  const [amountSaved, setAmountSaved] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);

  function saveFineAmount() {
    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      setAmountError("Valid amount daalo.");
      return;
    }
    setAmountError(null);
    setAmountSaved(false);
    startAmountTransition(async () => {
      const res = await fetch("/api/admin/fine-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAmountError(data.error ?? "Save failed.");
        return;
      }
      setAmountSaved(true);
    });
  }

  function remove(strikeId: string) {
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/strikes/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strikeId, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to remove.");
        return;
      }
      setOpenId(null);
      setReason("");
      window.location.reload();
    });
  }

  const active = strikes.filter((s) => !s.is_removed);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Strike Control (Private)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fine amount</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">₹</span>
            <input
              type="number"
              min={1}
              className="w-24 rounded glass-card px-2 py-1 text-sm"
              value={amountInput}
              onChange={(e) => {
                setAmountInput(e.target.value);
                setAmountSaved(false);
              }}
            />
            <Button size="sm" disabled={amountPending} onClick={saveFineAmount}>
              {amountPending ? "Saving…" : "Save"}
            </Button>
            {amountSaved && <span className="text-xs text-emerald-500">Saved ✓</span>}
          </div>
          <p className="text-xs text-muted-foreground">Every 3 strikes will trigger a fine of this amount. Existing fines will not be affected.</p>
          {amountError && <p className="text-xs text-destructive">{amountError}</p>}
        </div>

        {active.length === 0 && <p className="text-sm text-muted-foreground">No active strikes.</p>}
        {active.map((strike) => (
          <div key={strike.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
            <div>
              <p className="font-medium">{strike.user_name}</p>
              <p className="text-xs text-muted-foreground">
                {strike.reason.replace("_", " ")} — {formatDate(strike.created_at)}
              </p>
            </div>
            {openId === strike.id ? (
              <div className="flex items-center gap-2">
                <input
                  className="text-xs rounded glass-card px-2 py-1"
                  placeholder="Reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <Button size="sm" disabled={pending} onClick={() => remove(strike.id)}>
                  Confirm
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setOpenId(null)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setOpenId(strike.id)}>
                Remove
              </Button>
            )}
          </div>
        ))}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}