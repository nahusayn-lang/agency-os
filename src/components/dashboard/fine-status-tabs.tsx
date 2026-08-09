"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";

export interface FineTabItem {
  id: string;
  amount: number;
  status: "pending" | "submitted" | "paid" | "waived";
  deadline: string;
  proof_url: string | null;
  payment_comment: string | null;
  category: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  late_checkin: "Late Check-in",
  missed_checkout: "Missed Checkout",
  no_checkin: "Absent",
  fine_deadline_missed: "Deadline Missed",
  leave_rejected: "Leave Rejected",
  uncategorized: "Other",
};

const TABS_BASE = [
  { key: "topay", label: "To Pay" },
  { key: "paid", label: "Paid" },
  { key: "waived", label: "Waived" },
] as const;

const TAB_SUBMITTED = { key: "submitted", label: "Submitted" } as const;

type TabKey = "topay" | "submitted" | "paid" | "waived";

function matchesTab(status: FineTabItem["status"], tab: TabKey | null) {
  if (tab === null) return false;
  if (tab === "topay") return status === "pending";
  return status === tab;
}

/**
 * canPay: true for the employee's own list (shows Pay button on "pending"
 * fines, and a "Submitted" tab to track their own awaiting-confirmation fines).
 * adminActions: true for founder viewing a team member's fines (Waive only —
 * submitted/awaiting-confirmation fines are NOT shown here at all; they live
 * exclusively in Payment Review to avoid the same fine appearing in two places).
 */
export function FineStatusTabs({
  fines,
  canPay = false,
  adminActions = false,
}: {
  fines: FineTabItem[];
  canPay?: boolean;
  adminActions?: boolean;
}) {
  const router = useRouter();
  // Team Fines (adminActions) never shows a "submitted" tab — those fines
  // live only in Payment Review. Own "My Fines" view keeps it, so the person
  // can track their own payment while it's awaiting confirmation.
  const TABS = adminActions ? TABS_BASE : [TABS_BASE[0], TAB_SUBMITTED, TABS_BASE[1], TABS_BASE[2]];
  const visibleFines = adminActions ? fines.filter((f) => f.status !== "submitted") : fines;

  const [tab, setTab] = useState<TabKey | null>(null);
  const [pending, startTransition] = useTransition();
  const [openPayId, setOpenPayId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expandedFineId, setExpandedFineId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { topay: 0, submitted: 0, paid: 0, waived: 0 };
    visibleFines.forEach((f) => TABS.forEach((t) => matchesTab(f.status, t.key) && c[t.key]++));
    return c;
  }, [visibleFines, TABS]);

  const visible = visibleFines.filter((f) => matchesTab(f.status, tab));

  function submitPayment(fineId: string) {
    if (!file) {
      setError("A payment screenshot is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Your session has expired. Please log in again.");
        return;
      }
      const path = `${user.id}/${fineId}-${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("fine-proofs")
        .upload(path, file, { upsert: false });
      if (uploadError) {
        setError(uploadError.message);
        return;
      }
      const { data: signed } = await supabase.storage
        .from("fine-proofs")
        .createSignedUrl(path, 60 * 60 * 24 * 365);

      const res = await fetch("/api/admin/fines", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fineId, proofUrl: signed?.signedUrl ?? "", paymentComment: comment }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Submission failed.");
        return;
      }
      setOpenPayId(null);
      setFile(null);
      setComment("");
      router.refresh();
    });
  }

  function act(fineId: string, action: "paid" | "waived") {
    startTransition(async () => {
      await fetch("/api/admin/fines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fineId, action }),
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-lg border p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(tab === t.key ? null : t.key)}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
              tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/5"
            }`}
          >
            {t.label} ({counts[t.key]})
          </button>
        ))}
      </div>

      <div className="space-y-2">
        
        {visible.map((fine) => {
          const isOverdue = fine.status === "pending" && fine.deadline < today;
          const isExpanded = expandedFineId === fine.id;
          return (
            <div key={fine.id} className="rounded-lg border p-3 space-y-2">
              <div
                className="flex flex-wrap items-center justify-between gap-2 cursor-pointer select-none"
                onClick={() => setExpandedFineId(isExpanded ? null : fine.id)}
              >
                <span className="font-medium">₹{fine.amount}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/60 border border-white/10">
                  {CATEGORY_LABELS[fine.category] ?? fine.category}
                </span>
                {isOverdue && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/30">
                    overdue
                  </span>
                )}
                {!adminActions && fine.status === "submitted" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-500 border border-sky-500/30">
                    awaiting confirmation
                  </span>
                )}
                <span className={`text-white/40 text-xs transition-transform ${isExpanded ? "rotate-180" : ""}`}>▾</span>
              </div>
              {isExpanded && (
              <>
              <p className="text-xs text-muted-foreground">Deadline: {formatDate(fine.deadline)}</p>
              {fine.proof_url && (
                <a href={fine.proof_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                  View screenshot
                </a>
              )}
              {fine.payment_comment && (
                <p className="text-xs text-muted-foreground italic">&quot;{fine.payment_comment}&quot;</p>
              )}

              {canPay && fine.status === "pending" && (
                openPayId === fine.id ? (
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">
                        Payment screenshot <span className="text-destructive">*</span>
                      </label>
                      <Input type="file" accept="image/*" className="mt-1" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                    </div>
                    <textarea
                      className="w-full rounded-lg glass-card px-2 py-1.5 text-sm resize-none"
                      rows={2}
                      placeholder="Comment (optional)"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                    {error && <p className="text-xs text-destructive">{error}</p>}
                    <div className="flex gap-2">
                      <Button size="sm" disabled={pending} className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => submitPayment(fine.id)}>
                        {pending ? "Submitting…" : "Done"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setOpenPayId(null); setError(null); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => setOpenPayId(fine.id)}>
                    Pay
                  </Button>
                )
              )}

              {adminActions && fine.status === "pending" && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => act(fine.id, "waived")}>
                    Waive
                  </Button>
                </div>
              )}
              </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}