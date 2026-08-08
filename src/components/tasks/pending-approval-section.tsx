"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { updateTaskStatusAction, addTaskCommentAction } from "@/lib/tasks/actions";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { TaskStatus } from "@/lib/types/tasks";

export interface PendingApprovalTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignedToId: string;
  assignedToName: string;
  updatedAt: string;
  deadline?: string | null;
  timeSpentSeconds?: number | null;
  proofUrl: string | null;
  note: string | null;
  isMine: boolean;
}

type FilterKey = "all" | "waiting_review" | "in_progress" | "paused" | "pending" | "revision_required" | "completed";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "waiting_review", label: "Pending approval" },
  { key: "in_progress", label: "In progress" },
  { key: "paused", label: "Paused" },
  { key: "pending", label: "Pending" },
  { key: "revision_required", label: "Needs revision" },
  { key: "completed", label: "Completed" },
];

const BORDER_COLOR: Record<TaskStatus, string> = {
  pending: "border-l-muted-foreground/40",
  in_progress: "border-l-amber-500",
  paused: "border-l-orange-500",
  waiting_review: "border-l-purple-500",
  revision_required: "border-l-red-500",
  approved: "border-l-emerald-500",
  completed: "border-l-emerald-500",
};

const BADGE_STYLE: Record<TaskStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  paused: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  waiting_review: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  revision_required: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const BADGE_LABEL: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  paused: "Paused",
  waiting_review: "Pending approval",
  revision_required: "Needs revision",
  approved: "Completed",
  completed: "Completed",
};

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 6;
const ZOOM_STEP = 0.5;
const FIT_ZOOM = 1;

function matchesFilter(status: TaskStatus, filter: FilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "completed") return status === "approved" || status === "completed";
  return status === filter;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return formatDateTime(iso);
}

function formatTimeSpent(seconds?: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  if (mins > 0) return `${mins}m`;
  return `${seconds}s`;
}

function isWithin(iso: string, range: "today" | "week" | "month"): boolean {
  const d = new Date(iso);
  const now = new Date();
  if (range === "today") return d.toDateString() === now.toDateString();
  const diffDays = (now.getTime() - d.getTime()) / 86400000;
  if (range === "week") return diffDays <= 7;
  return diffDays <= 30;
}

export function PendingApprovalSection({
  tasks,
  isFounder,
  currentUserId,
}: {
  tasks: PendingApprovalTask[];
  isFounder: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"mine" | "team">("team");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [memberFilter, setMemberFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [proofModalUrl, setProofModalUrl] = useState<string | null>(null);
  const [proofZoom, setProofZoom] = useState(FIT_ZOOM);
  const [pending, startTransition] = useTransition();

  const members = useMemo(
    () =>
      Array.from(
        new Set(
          tasks
            .filter((t) => (isFounder && tab === "mine" ? t.assignedToId === currentUserId : true))
            .filter((t) => (isFounder && tab === "team" ? t.assignedToId !== currentUserId : true))
            .map((t) => t.assignedToName)
        )
      ).sort(),
    [tasks, isFounder, tab, currentUserId]
  );

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: 0,
      waiting_review: 0,
      in_progress: 0,
      paused: 0,
      pending: 0,
      revision_required: 0,
      completed: 0,
    };
    for (const t of tasks) {
      if (removedIds.has(t.id)) continue;
      if (isFounder && tab === "mine" && t.assignedToId !== currentUserId) continue;
      if (isFounder && tab === "team" && t.assignedToId === currentUserId) continue;
      c.all += 1;
      if (matchesFilter(t.status, "waiting_review")) c.waiting_review += 1;
      if (matchesFilter(t.status, "in_progress")) c.in_progress += 1;
      if (matchesFilter(t.status, "paused")) c.paused += 1;
      if (matchesFilter(t.status, "pending")) c.pending += 1;
      if (matchesFilter(t.status, "revision_required")) c.revision_required += 1;
      if (matchesFilter(t.status, "completed")) c.completed += 1;
    }
    return c;
  }, [tasks, removedIds, isFounder, tab, currentUserId]);

  const visible = useMemo(() => {
    return tasks
      .filter((t) => !removedIds.has(t.id))
      .filter((t) => (isFounder && tab === "mine" ? t.assignedToId === currentUserId : true))
      .filter((t) => (isFounder && tab === "team" ? t.assignedToId !== currentUserId : true))
      .filter((t) => matchesFilter(t.status, filter))
      .filter((t) => (memberFilter === "all" ? true : t.assignedToName === memberFilter))
      .filter((t) => (dateFilter === "all" ? true : isWithin(t.updatedAt, dateFilter)));
  }, [tasks, removedIds, isFounder, tab, filter, memberFilter, dateFilter]);

  function approve(taskId: string) {
    setError(null);
    startTransition(async () => {
      const res = await updateTaskStatusAction(taskId, "approved");
      if (res?.error) {
        setError(res.error);
        return;
      }
      setRemovedIds((prev) => new Set(prev).add(taskId));
      router.refresh();
    });
  }

  function submitReject(taskId: string) {
    setError(null);
    startTransition(async () => {
      const trimmed = reason.trim();
      if (trimmed) {
        const commentRes = await addTaskCommentAction(taskId, `[Revision Requested] ${trimmed}`);
        if (commentRes?.error) {
          setError(commentRes.error);
          return;
        }
      }
      const res = await updateTaskStatusAction(taskId, "revision_required");
      if (res?.error) {
        setError(res.error);
        return;
      }
      setReason("");
      setRejectingId(null);
      setRemovedIds((prev) => new Set(prev).add(taskId));
      router.refresh();
    });
  }

  if (tasks.length === 0) return null;

  return (
    <div className="space-y-3">
      {isFounder && (
        <div className="flex justify-center">
          <div className="inline-flex rounded-full bg-muted p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => setTab("team")}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                tab === "team" ? "bg-purple-600 text-white" : "text-muted-foreground"
              }`}
            >
              Team tasks
            </button>
            <button
              type="button"
              onClick={() => setTab("mine")}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                tab === "mine" ? "bg-purple-600 text-white" : "text-muted-foreground"
              }`}
            >
              My tasks
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`text-xs px-3 py-1 rounded-full transition-colors ${
              filter === f.key
                ? "bg-purple-600 text-white"
                : "border text-foreground hover:bg-muted"
            }`}
          >
            {f.label}{" "}
            <span className={filter === f.key ? "opacity-80" : "text-muted-foreground"}>
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      {isFounder && tab === "team" && (
        <div className="flex items-center gap-2">
          <select
            className="text-xs rounded border px-2 py-1.5 bg-background flex-1"
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
          >
            <option value="all">All members</option>
            {members.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            className="text-xs rounded border px-2 py-1.5 bg-background flex-1"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)}
          >
            <option value="all">Any date</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
          </select>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex flex-col gap-2">
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No tasks here.</p>
        ) : (
          visible.map((task) => {
            const isExpanded = expandedId === task.id;
            const isRejecting = rejectingId === task.id;
            const needsApproval = task.status === "waiting_review";
            const timeSpentLabel = formatTimeSpent(task.timeSpentSeconds);

            return (
              <div
                key={task.id}
                className={`rounded-xl border border-l-4 ${BORDER_COLOR[task.status]} bg-card overflow-hidden transition-shadow hover:shadow-sm`}
              >
                {/* Collapsed content — always visible, no click required */}
                <div className="flex items-start justify-between gap-2 px-3.5 py-3 sm:px-4">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-sm font-medium leading-snug break-words">{task.title}</p>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <UserIcon />
                        {task.assignedToName}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ClockIcon />
                        Submitted {timeAgo(task.updatedAt)}
                      </span>
                      {task.deadline && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarIcon />
                          Due {formatDate(task.deadline)}
                        </span>
                      )}
                      {timeSpentLabel && (
                        <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
                          <TimerIcon />
                          {timeSpentLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {needsApproval ? (
                      <>
                        <button
                          type="button"
                          aria-label="Approve"
                          disabled={pending}
                          onClick={() => approve(task.id)}
                          className="w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center disabled:opacity-50 transition-colors"
                        >
                          <CheckIcon />
                        </button>
                        <button
                          type="button"
                          aria-label="Reject"
                          disabled={pending}
                          onClick={() => {
                            setRejectingId(isRejecting ? null : task.id);
                            setExpandedId(task.id);
                            setError(null);
                          }}
                          className="w-8 h-8 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 flex items-center justify-center disabled:opacity-50 transition-colors"
                        >
                          <XIcon />
                        </button>
                      </>
                    ) : (
                      <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${BADGE_STYLE[task.status]}`}>
                        {BADGE_LABEL[task.status]}
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label={isExpanded ? "Collapse details" : "Expand details"}
                      onClick={() => setExpandedId(isExpanded ? null : task.id)}
                      className="text-muted-foreground hover:text-foreground ml-0.5 p-1 rounded-md hover:bg-muted transition-colors"
                    >
                      <ChevronIcon open={isExpanded} />
                    </button>
                  </div>
                </div>

                {/* Expanded content — description, proof, reject box */}
                {isExpanded && (
                  <div className="px-3.5 sm:px-4 pb-4 pt-3 border-t space-y-3.5 bg-muted/20">
                    {task.description && (
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Description
                        </p>
                        <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
                          {task.description}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {task.proofUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setProofZoom(FIT_ZOOM);
                            setProofModalUrl(task.proofUrl);
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-purple-100 text-purple-700 border border-purple-200 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800 dark:hover:bg-purple-900/50 transition-colors"
                        >
                          <ImageIcon />
                          Proof
                        </button>
                      )}
                      <Link
                        href={`/tasks/${task.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border text-foreground hover:bg-muted transition-colors"
                      >
                        <ExternalIcon />
                        View details
                      </Link>
                    </div>

                    {task.note && (
                      <p className="text-xs text-muted-foreground italic border-l-2 pl-2.5">
                        &quot;{task.note}&quot;
                      </p>
                    )}

                    {needsApproval && isRejecting && (
                      <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                        <textarea
                          autoFocus
                          className="w-full text-sm rounded-md border px-2.5 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-destructive/40"
                          placeholder="Revision ka reason likho (optional)"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => submitReject(task.id)}
                            className="text-xs px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                          >
                            Confirm reject
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingId(null);
                              setReason("");
                            }}
                            className="text-xs px-3 py-1.5 rounded-lg border hover:bg-muted transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {proofModalUrl && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/90"
          onClick={() => setProofModalUrl(null)}
        >
          <div
            className="flex items-center justify-between px-4 py-3 sm:px-6"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-sm font-medium text-white">Proof screenshot</span>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setProofModalUrl(null)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <XIcon />
            </button>
          </div>

          <div
            className="relative flex-1 overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex min-h-full items-center justify-center p-4"
              style={{ cursor: proofZoom > FIT_ZOOM ? "grab" : "default" }}
            >
              <Image
                src={proofModalUrl}
                alt="Proof screenshot"
                width={1200}
                height={900}
                className="max-w-none object-contain transition-transform duration-150 ease-out select-none"
                style={{
                  width: `min(95vw, ${proofZoom * 95}vw, ${proofZoom * 1400}px)`,
                  maxHeight: `${proofZoom * 85}vh`,
                  height: "auto",
                }}
                draggable={false}
              />
            </div>
          </div>

          <div
            className="flex items-center justify-center gap-2 px-4 py-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Zoom out"
              disabled={proofZoom <= MIN_ZOOM}
              onClick={() => setProofZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)))}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 transition-colors"
            >
              <MinusIcon />
            </button>
            <span className="min-w-[3.5rem] text-center text-xs font-medium text-white/80 tabular-nums">
              {Math.round(proofZoom * 100)}%
            </span>
            <button
              type="button"
              aria-label="Zoom in"
              disabled={proofZoom >= MAX_ZOOM}
              onClick={() => setProofZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)))}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 transition-colors"
            >
              <PlusIcon />
            </button>
            {proofZoom !== FIT_ZOOM && (
              <button
                type="button"
                onClick={() => setProofZoom(FIT_ZOOM)}
                className="ml-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-70">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-70">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-70">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function TimerIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-80">
      <line x1="10" y1="2" x2="14" y2="2" />
      <line x1="12" y1="14" x2="12" y2="9" />
      <circle cx="12" cy="14" r="8" />
    </svg>
  );
}