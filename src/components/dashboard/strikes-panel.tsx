"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface StrikeRow {
  id: string;
  user_name: string;
  reason: string;
  is_removed: boolean;
  created_at: string;
}

/** Founder-only, private control. Parent must gate behind role === "super_admin". */
export function StrikesPanel({ strikes }: { strikes: StrikeRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pointerIndex, setPointerIndex] = useState<Record<string, number>>({});
  const [detailsOpenFor, setDetailsOpenFor] = useState<string | null>(null);
  const [removeReasonFor, setRemoveReasonFor] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Har user ke liye: sirf active strikes, oldest→newest sorted (index 0 = pehli,
  // last index = sabse latest). Pointer hamesha "sabse latest active" strike ko
  // point karta hai jab tak user khud navigate na kare.
  const grouped = useMemo(() => {
    const map = new Map<string, StrikeRow[]>();
    strikes.forEach((s) => {
      if (!map.has(s.user_name)) map.set(s.user_name, []);
      map.get(s.user_name)!.push(s);
    });
    map.forEach((list) => list.sort((a, b) => a.created_at.localeCompare(b.created_at)));
    return map;
  }, [strikes]);

  function activeList(userName: string) {
    return (grouped.get(userName) ?? []).filter((s) => !s.is_removed);
  }

  function removedList(userName: string) {
    return (grouped.get(userName) ?? []).filter((s) => s.is_removed);
  }

  function currentIndex(userName: string) {
    const active = activeList(userName);
    const saved = pointerIndex[userName];
    if (saved !== undefined && saved < active.length) return saved;
    return active.length - 1; // default: latest active strike
  }

  function removeStrike(strikeId: string, userName: string) {
    if (!reasonText.trim()) {
      setError("Reason likhna zaroori hai.");
      return;
    }
    setError(null);
    setBusyId(strikeId);
    startTransition(async () => {
      const res = await fetch("/api/admin/strikes/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strikeId, reason: reasonText }),
      });
      const data = await res.json();
      setBusyId(null);
      if (!res.ok) {
        setError(data.error ?? "Failed to remove.");
        return;
      }
      setRemoveReasonFor(null);
      setReasonText("");
      // Pointer ek step peeche kar do (agla active strike jo dikhega)
      setPointerIndex((prev) => ({ ...prev, [userName]: Math.max(0, currentIndex(userName) - 1) }));
      router.refresh();
    });
  }

  function restoreStrike(strikeId: string, userName: string) {
    setBusyId(strikeId);
    startTransition(async () => {
      const res = await fetch("/api/admin/strikes/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strikeId }),
      });
      setBusyId(null);
      if (res.ok) {
        setPointerIndex((prev) => ({ ...prev, [userName]: currentIndex(userName) + 1 }));
        router.refresh();
      }
    });
  }

  if (grouped.size === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Strike Control</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Koi strike nahi hai.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-white/70">Strike Control</h3>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from(grouped.keys()).map((userName) => {
          const active = activeList(userName);
          const removed = removedList(userName);
          const idx = currentIndex(userName);
          const current = active[idx] ?? null;
          const isBusy = pending && (busyId === current?.id);

          return (
            <Card key={userName}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span>{userName}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/30">
                    {active.length} active
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {active.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Koi active strike nahi.</p>
                ) : (
                  <div className="rounded-lg border p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        disabled={idx <= 0}
                        onClick={() => setPointerIndex((prev) => ({ ...prev, [userName]: idx - 1 }))}
                      >
                        ‹
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Strike #{idx + 1} / {active.length}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        disabled={idx >= active.length - 1}
                        onClick={() => setPointerIndex((prev) => ({ ...prev, [userName]: idx + 1 }))}
                      >
                        ›
                      </Button>
                    </div>

                    {current && (
                      <>
                        <p className="text-sm">
                          <span className="font-medium">{current.reason.replace(/_/g, " ")}</span>
                          <span className="text-muted-foreground"> — {new Date(current.created_at).toLocaleString()}</span>
                        </p>

                        {removeReasonFor === current.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              className="text-xs rounded border px-2 py-1 bg-background flex-1"
                              placeholder="Reason"
                              value={reasonText}
                              onChange={(e) => setReasonText(e.target.value)}
                            />
                            <Button size="sm" disabled={isBusy} onClick={() => removeStrike(current.id, userName)}>
                              OK
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              disabled={isBusy}
                              onClick={() => {
                                setRemoveReasonFor(current.id);
                                setReasonText("");
                                setError(null);
                              }}
                            >
                              − Remove
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {removed.length > 0 && (
                  <div className="rounded-lg border border-dashed p-2.5 space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      Last removed: {removed[removed.length - 1].reason.replace(/_/g, " ")}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending && busyId === removed[removed.length - 1].id}
                      onClick={() => restoreStrike(removed[removed.length - 1].id, userName)}
                    >
                      + Restore
                    </Button>
                  </div>
                )}

                <button
                  className="text-xs text-primary underline underline-offset-2"
                  onClick={() => setDetailsOpenFor(detailsOpenFor === userName ? null : userName)}
                >
                  {detailsOpenFor === userName ? "Details band karo" : "Sabhi strikes ki details dekho"}
                </button>

                {detailsOpenFor === userName && (
                  <div className="space-y-1.5 pt-1 border-t">
                    {(grouped.get(userName) ?? [])
                      .slice()
                      .reverse()
                      .map((s) => (
                        <div key={s.id} className="flex items-center justify-between gap-2 text-xs rounded border p-1.5">
                          <div className="min-w-0">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded-full border mr-1.5 ${
                                s.is_removed
                                  ? "bg-muted text-muted-foreground border-border"
                                  : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                              }`}
                            >
                              {s.is_removed ? "removed" : "active"}
                            </span>
                            <span className="text-muted-foreground">
                              {s.reason.replace(/_/g, " ")} — {new Date(s.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {s.is_removed ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[11px] px-2"
                              disabled={pending && busyId === s.id}
                              onClick={() => restoreStrike(s.id, userName)}
                            >
                              + Restore
                            </Button>
                          ) : (
                            removeReasonFor === s.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  className="text-[11px] rounded border px-1.5 py-0.5 bg-background w-20"
                                  placeholder="Reason"
                                  value={reasonText}
                                  onChange={(e) => setReasonText(e.target.value)}
                                />
                                <Button size="sm" className="h-6 text-[11px] px-2" disabled={pending && busyId === s.id} onClick={() => removeStrike(s.id, userName)}>
                                  OK
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[11px] px-2"
                                onClick={() => {
                                  setRemoveReasonFor(s.id);
                                  setReasonText("");
                                  setError(null);
                                }}
                              >
                                − Remove
                              </Button>
                            )
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}