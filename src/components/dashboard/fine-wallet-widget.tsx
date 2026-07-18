"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

export interface FineWalletItem {
  id: string;
  amount: number;
  status: "pending" | "submitted" | "paid" | "waived";
  deadline: string;
  proof_url: string | null;
  payment_comment: string | null;
}

function statusStyles(status: FineWalletItem["status"], isOverdue: boolean) {
  if (status === "paid") return "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30";
  if (status === "waived") return "bg-muted text-muted-foreground border border-border";
  if (status === "submitted") return "bg-sky-500/10 text-sky-500 border border-sky-500/30";
  if (isOverdue) return "bg-destructive/10 text-destructive border border-destructive/30";
  return "bg-amber-500/10 text-amber-500 border border-amber-500/30";
}

function statusText(status: FineWalletItem["status"], isOverdue: boolean) {
  if (status === "pending" && isOverdue) return "overdue";
  if (status === "submitted") return "waiting confirmation";
  return status;
}

/** Fine Pay — employee-facing card. Screenshot mandatory, comment optional. */
export function FineWalletWidget({ fines }: { fines: FineWalletItem[] }) {
  const [pending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  // "Due" = not yet actually paid — pending and submitted (awaiting confirmation) both still count.
  const totalDue = fines
    .filter((f) => f.status === "pending" || f.status === "submitted")
    .reduce((sum, f) => sum + Number(f.amount), 0);

  function submitPayment(fineId: string) {
    if (!file) {
      setError("Payment screenshot lagana zaroori hai.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Session expire ho gaya, dobara login karo.");
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
        body: JSON.stringify({
          fineId,
          proofUrl: signed?.signedUrl ?? "",
          paymentComment: comment,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Submit nahi hua.");
        return;
      }
      setOpenId(null);
      setFile(null);
      setComment("");
      window.location.reload();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>Fine pay</span>
          {totalDue > 0 && (
            <span className="text-destructive text-sm font-semibold">₹{totalDue} due</span>
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">₹{fine.amount}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusStyles(fine.status, isOverdue)}`}>
                  {statusText(fine.status, isOverdue)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Deadline: {formatDate(fine.deadline)}</p>

              {fine.proof_url && (
                <a href={fine.proof_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                  Screenshot dekho
                </a>
              )}

              {fine.status === "pending" && (
                <>
                  {openId === fine.id ? (
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">
                          Payment screenshot <span className="text-destructive">*</span>
                        </label>
                        <Input
                          type="file"
                          accept="image/*"
                          className="mt-1"
                          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Comment (optional)</label>
                        <textarea
                          className="mt-1 w-full rounded-lg border bg-background px-2 py-1.5 text-sm resize-none"
                          rows={2}
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                        />
                      </div>
                      {error && <p className="text-xs text-destructive">{error}</p>}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={pending}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => submitPayment(fine.id)}
                        >
                          {pending ? "Submitting…" : "Done"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setOpenId(null); setError(null); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => setOpenId(fine.id)}>
                      Pay
                    </Button>
                  )}
                </>
              )}

              {fine.status === "submitted" && (
                <p className="text-xs text-sky-500">Proof submit ho gaya — founder confirm karega toh paid ho jayega.</p>
              )}

              {fine.payment_comment && (
                <p className="text-xs text-muted-foreground italic">&quot;{fine.payment_comment}&quot;</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}