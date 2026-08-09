"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListTree } from "lucide-react";
import { formatDate } from "@/lib/utils";

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
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // For each user: only active strikes, sorted oldest→newest (index 0 = first,
  // last index = most recent). The pointer always points to the "most recent active"
  // strike until the user navigates manually.
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
      setError("A reason is required.");
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
      // Move the pointer back one step (the next active strike that will show)
      setPointerIndex((prev) => ({ ...prev, [userName]: Math.max(0, currentIndex(userName) - 1) }));
      window.scrollTo({ top: 0, behavior: "smooth" });
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
        window.scrollTo({ top: 0, behavior: "smooth" });
      router.refresh();
      }
    });
  }

  if (grouped.size === 0) {
    return null;
  }

  function handleTouchStart(e: React.TouchEvent) {
    setTouchStartX(e.touches[0].clientX);
  }

  function handleTouchEnd(e: React.TouchEvent, userName: string, idx: number, max: number) {
    if (touchStartX === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const SWIPE_THRESHOLD = 40;
    if (deltaX > SWIPE_THRESHOLD && idx > 0) {
      setPointerIndex((prev) => ({ ...prev, [userName]: idx - 1 })); // swipe right -> previous
    } else if (deltaX < -SWIPE_THRESHOLD && idx < max - 1) {
      setPointerIndex((prev) => ({ ...prev, [userName]: idx + 1 })); // swipe left -> next
    }
    setTouchStartX(null);
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
            <Card key={userName} className="rounded-xl">
              <CardHeader
                className="pb-2 pt-3 px-3.5 cursor-pointer select-none"
                onClick={() => setExpandedUser(expandedUser === userName ? null : userName)}
              >
                <CardTitle className="text-xs font-medium flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/30 flex items-center justify-center text-[10px] font-medium">
                      {userName.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-sm">{userName}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground tracking-wide">
                      {active.length} ACTIVE
                    </span>
                    <span
                      className={`text-white/40 text-xs transition-transform ${
                        expandedUser === userName ? "rotate-180" : ""
                      }`}
                    >
                      ▾
                    </span>
                  </span>
                </CardTitle>
              </CardHeader>
              {expandedUser === userName && (
              <CardContent className="space-y-2.5 px-3.5 pb-3.5">
                {active.length === 0 ? null : (
                  <div
                    className="rounded-lg bg-white/[0.03] p-3 space-y-2.5 select-none"
                    onTouchStart={handleTouchStart}
                    onTouchEnd={(e) => handleTouchEnd(e, userName, idx, active.length)}
                  >
                    <div className="flex items-center justify-between">
                      <button
                        aria-label="Previous strike"
                        className="w-6 h-6 rounded-full border border-white/15 flex items-center justify-center text-white/60 hover:bg-white/5 disabled:opacity-30 transition-colors"
                        disabled={idx <= 0}
                        onClick={() => setPointerIndex((prev) => ({ ...prev, [userName]: idx - 1 }))}
                      >
                        ‹
                      </button>
                      <span className="text-[11px] text-muted-foreground">
                        {idx + 1} / {active.length}
                      </span>
                      <button
                        aria-label="Next strike"
                        className="w-6 h-6 rounded-full border border-white/15 flex items-center justify-center text-white/60 hover:bg-white/5 disabled:opacity-30 transition-colors"
                        disabled={idx >= active.length - 1}
                        onClick={() => setPointerIndex((prev) => ({ ...prev, [userName]: idx + 1 }))}
                      >
                        ›
                      </button>
                    </div>

                    {current && (
                      <>
                        <div>
                          <p className="text-[13px] font-medium">{current.reason.replace(/_/g, " ")}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(current.created_at)}</p>
                        </div>

                        {removeReasonFor === current.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              className="text-xs rounded glass-card px-2 py-1 flex-1"
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
                              className="flex-1 h-7 text-xs"
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
                  className="flex items-center gap-1.5 text-xs text-primary"
                  onClick={() => setDetailsOpenFor(detailsOpenFor === userName ? null : userName)}
                >
                  <ListTree size={13} />
                  Details
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
                              {s.reason.replace(/_/g, " ")} — {formatDate(s.created_at)}
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
                                  className="text-[11px] rounded glass-card px-1.5 py-0.5 w-20"
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
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}