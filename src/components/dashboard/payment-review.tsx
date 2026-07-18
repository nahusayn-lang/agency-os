"use client";
import { formatDate } from "@/lib/utils";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";


export interface PaymentReviewItem {
  id: string;
  user_name: string;
  amount: number;
  deadline: string;
  proof_url: string | null;
  payment_comment: string | null;
}

/**
 * Founder-only. Shows every "submitted" fine (proof uploaded, awaiting
 * confirmation) — including founder's own — grouped by user as clickable
 * pill-tabs (CRM stage-tab pattern). Only one user's list is expanded at a
 * time; tabs wrap responsively so this scales to any team size.
 */
export function PaymentReview({ items }: { items: PaymentReviewItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeUser, setActiveUser] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, PaymentReviewItem[]>();
    items.forEach((item) => {
      if (!map.has(item.user_name)) map.set(item.user_name, []);
      map.get(item.user_name)!.push(item);
    });
    return map;
  }, [items]);

  function act(fineId: string, action: "paid" | "reject") {
    startTransition(async () => {
      await fetch("/api/admin/fines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fineId, action }),
      });
      router.refresh();
    });
  }

  const activeItems = activeUser ? grouped.get(activeUser) ?? [] : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          Payment Review
          {items.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-500 border border-sky-500/30">
              {items.length} pending
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {grouped.size === 0 && (
          <p className="text-sm text-muted-foreground">No payments pending review.</p>
        )}

        {grouped.size > 0 && (
          <div className="flex flex-wrap gap-2">
            {Array.from(grouped.entries()).map(([userName, userItems]) => {
              const isActive = activeUser === userName;
              return (
                <button
                  key={userName}
                  onClick={() => setActiveUser(isActive ? null : userName)}
                  className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                    isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-white/10 text-white/80 hover:bg-white/5"
                  }`}
                >
                  {userName}
                  <span className={`text-xs ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                    {userItems.length}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        

        {activeUser && (
          <div className="space-y-2">
            {activeItems.map((item) => (
              <div key={item.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-sm">{item.user_name}</span>
                  <span className="text-sm font-semibold">₹{item.amount}</span>
                </div>
                <p className="text-xs text-muted-foreground">Deadline: {formatDate(item.deadline)}</p>
                {item.proof_url && (
                  <a href={item.proof_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline block">
                    View screenshot
                  </a>
                )}
                {item.payment_comment && (
                  <p className="text-xs text-muted-foreground italic">&quot;{item.payment_comment}&quot;</p>
                )}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" disabled={pending} className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => act(item.id, "paid")}>
                    Confirm paid
                  </Button>
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => act(item.id, "reject")}>
                    Reject proof
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}