"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
export function StrikeControlPanel({ strikes }: { strikes: StrikeRow[] }) {
  const [pending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function remove(strikeId: string) {
    if (!reason.trim()) {
      setError("Reason likhna zaroori hai.");
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
      <CardContent className="space-y-2">
        {active.length === 0 && <p className="text-sm text-muted-foreground">Koi active strike nahi hai.</p>}
        {active.map((strike) => (
          <div key={strike.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
            <div>
              <p className="font-medium">{strike.user_name}</p>
              <p className="text-xs text-muted-foreground">
                {strike.reason.replace("_", " ")} — {new Date(strike.created_at).toLocaleString()}
              </p>
            </div>
            {openId === strike.id ? (
              <div className="flex items-center gap-2">
                <input
                  className="text-xs rounded border px-2 py-1 bg-background"
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