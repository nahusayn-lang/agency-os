"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Founder-only system setting: how much a fine costs (per 3 strikes). */
export function FineAmountSetting({ fineAmount }: { fineAmount: number }) {
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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Fine Amount Setting</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
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
        <p className="text-xs text-muted-foreground">
          Every 3 strikes will trigger a fine of this amount. Existing fines will not be affected.
        </p>
        {amountError && <p className="text-xs text-destructive">{amountError}</p>}
      </CardContent>
    </Card>
  );
}