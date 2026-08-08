"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  updateLeadStageAction,
  updateLeadAssigneeAction,
  updateLeadAction,
  bulkUpdateLeadStageAction,
  bulkUpdateLeadAssigneeAction,
  rescheduleMeetingAction,
} from "@/lib/crm/actions";
import {
  ASSIGNEE_CHANGEABLE_STAGES,
  LEAD_STAGE_LABELS,
  type LeadStage,
  type MeetingHistoryEntry,
} from "@/lib/types/crm";

export interface AssignableUser {
  id: string;
  name: string;
}

export interface KanbanLead {
  id: string;
  name: string;
  business_name: string | null;
  phone: string | null;
  deal_value: number | null;
  stage: LeadStage;
  last_contact: string | null;
  next_followup: string | null;
  meeting_datetime: string | null;
  meeting_note: string | null;
  meeting_history: MeetingHistoryEntry[];
  assignee: { id: string; name: string };
}

interface KanbanBoardProps {
  leads: KanbanLead[];
  stages: LeadStage[];
  assignableUsers: AssignableUser[];
  canReassign: boolean;
  currentUserId: string;
}

type FollowupFilter = "all" | "overdue" | "due_today" | "not_set";

function getFollowupBucket(iso: string | null): "overdue" | "due_today" | "upcoming" | "not_set" {
  if (!iso) return "not_set";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "not_set";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  if (d.getTime() < startOfToday.getTime()) return "overdue";
  if (d.getTime() < startOfTomorrow.getTime()) return "due_today";
  return "upcoming";
}

/**
 * Long-press (mobile) selection trigger. Ignores presses that start on an
 * interactive child (buttons, links, inputs) so it never hijacks the
 * existing Move / assignee / date-chip taps, and cancels itself if the
 * finger moves (i.e. the user was scrolling, not holding).
 */
function useLongPress(onLongPress: () => void, ms = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const movedRef = useRef(false);

  function clear() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  function onTouchStart(e: React.TouchEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, label")) return;
    movedRef.current = false;
    clear();
    timerRef.current = setTimeout(() => {
      if (!movedRef.current) onLongPress();
    }, ms);
  }

  function onTouchMove() {
    movedRef.current = true;
    clear();
  }

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd: clear,
    onTouchCancel: clear,
  };
}

const STAGE_COLORS: Record<
  LeadStage,
  { tab: string; badge: string; dot: string }
> = {
  new_lead: {
    tab: "border-blue-500 text-blue-400",
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    dot: "bg-blue-500",
  },
  call_pending: {
    tab: "border-yellow-500 text-yellow-400",
    badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    dot: "bg-yellow-500",
  },
  interested: {
    tab: "border-purple-500 text-purple-400",
    badge: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    dot: "bg-purple-500",
  },
  meeting: {
    tab: "border-cyan-500 text-cyan-400",
    badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    dot: "bg-cyan-500",
  },
  negotiation: {
    tab: "border-orange-500 text-orange-400",
    badge: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    dot: "bg-orange-500",
  },
  deal_won: {
    tab: "border-emerald-500 text-emerald-400",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    dot: "bg-emerald-500",
  },
  deal_lost: {
    tab: "border-red-500 text-red-400",
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
    dot: "bg-red-500",
  },
};

function toWhatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return "91" + digits;
  if (digits.length === 11 && digits.startsWith("0")) return "91" + digits.slice(1);
  return digits;
}

function AssigneeDropdown({
  currentAssignee,
  users,
  disabled,
  onSelect,
}: {
  currentAssignee: { id: string; name: string };
  users: AssignableUser[];
  disabled: boolean;
  onSelect: (userId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    // small delay so the same click that opens it doesn't also close it
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 30);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      clearTimeout(focusTimer);
    };
  }, [open]);

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  if (!users.length) {
    // no permission / nothing to pick from — plain text
    return (
      <span className="text-xs text-muted-foreground">
        {currentAssignee.name}
      </span>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setQuery("");
          setOpen((v) => !v);
        }}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none max-w-[140px]"
      >
        <span className="truncate">{currentAssignee.name}</span>
        <svg
          viewBox="0 0 24 24"
          width="11"
          height="11"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="shrink-0"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1.5 w-56 max-w-[80vw] rounded-lg border bg-popover shadow-lg overflow-hidden">
          <div className="p-1.5 border-b">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name..."
              className="w-full rounded-md border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                No matches.
              </p>
            ) : (
              filtered.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (u.id !== currentAssignee.id) onSelect(u.id);
                  }}
                  className={
                    "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-muted " +
                    (u.id === currentAssignee.id
                      ? "text-foreground font-medium"
                      : "text-muted-foreground")
                  }
                >
                  <span className="truncate">{u.name}</span>
                  {u.id === currentAssignee.id && (
                    <svg
                      viewBox="0 0 24 24"
                      width="12"
                      height="12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="shrink-0 text-primary"
                    >
                      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatShortDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function formatMeetingDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toTimeInputValue(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function useClickOutside(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  return ref;
}

function LastContactChip({
  value,
  disabled,
  onChange,
}: {
  value: string | null;
  disabled: boolean;
  onChange: (iso: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(open, () => setOpen(false));

  const label = value ? "Last: " + formatShortDate(value) : "Last contact";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="text-[11px] px-1.5 py-0.5 rounded-md border border-transparent text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        🕓 {label}
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-1.5 w-48 rounded-lg border bg-popover shadow-lg p-1.5 space-y-1">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onChange(new Date().toISOString());
            }}
            className="w-full text-left text-xs px-2 py-1.5 rounded-md hover:bg-muted transition-colors font-medium text-emerald-400"
          >
            ✓ Mark contacted today
          </button>

          <label className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer text-xs text-muted-foreground">
            Custom date
            <input
              type="date"
              defaultValue={value ? value.slice(0, 10) : ""}
              className="text-xs bg-transparent outline-none w-[92px]"
              onChange={(e) => {
                if (!e.target.value) return;
                setOpen(false);
                onChange(e.target.value);
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}

function NextFollowupChip({
  value,
  disabled,
  onChange,
}: {
  value: string | null;
  disabled: boolean;
  onChange: (iso: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(open, () => setOpen(false));

  const overdue = isOverdue(value);
  const label = value ? "Next: " + formatShortDate(value) : "Next follow-up";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={
          "text-[11px] px-1.5 py-0.5 rounded-md border transition-colors disabled:opacity-50 whitespace-nowrap " +
          (overdue
            ? "border-red-500/30 text-red-400 bg-red-500/10"
            : "border-transparent text-muted-foreground hover:text-foreground hover:border-border")
        }
      >
        📅 {label}
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-1.5 w-48 rounded-lg border bg-popover shadow-lg p-1.5 space-y-1">
          <div className="flex gap-1">
            {[
              { label: "Tomorrow", days: 1 },
              { label: "+3d", days: 3 },
              { label: "+1w", days: 7 },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onChange(addDaysIso(opt.days));
                }}
                className="flex-1 text-[11px] px-1.5 py-1 rounded-md border hover:bg-muted transition-colors"
              >
                {opt.label}
              </button>
            ))}
          </div>

          <label className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer text-xs text-muted-foreground">
            Custom date
            <input
              type="date"
              defaultValue={value ? value.slice(0, 10) : ""}
              className="text-xs bg-transparent outline-none w-[92px]"
              onChange={(e) => {
                if (!e.target.value) return;
                setOpen(false);
                onChange(e.target.value);
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}

/**
 * Gated stage-transition popup: mandatory date + time before a lead can
 * move into "Meeting", and reused as-is for rescheduling an existing
 * meeting. No skip option — a lead can't be in the Meeting stage
 * without an actual scheduled time (that's the whole point).
 */
function MeetingModal({
  open,
  mode,
  initialDatetime,
  initialNote,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  mode: "schedule" | "reschedule";
  initialDatetime: string | null;
  initialNote: string | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: (isoDatetime: string, note: string) => void;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    const base = initialDatetime ? new Date(initialDatetime) : null;
    setDate(base && !isNaN(base.getTime()) ? toDateInputValue(base) : "");
    setTime(base && !isNaN(base.getTime()) ? toTimeInputValue(base) : "");
    setNote(initialNote ?? "");
  }, [open, initialDatetime, initialNote]);

  if (!open) return null;

  function pickQuickDate(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDate(toDateInputValue(d));
  }

  const canConfirm = Boolean(date && time);

  function handleConfirm() {
    if (!canConfirm) return;
    const iso = new Date(`${date}T${time}`).toISOString();
    onConfirm(iso, note);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm rounded-xl border bg-card p-4 space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="font-semibold text-sm">
            {mode === "schedule" ? "Schedule Meeting" : "Reschedule Meeting"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Date and time are required — the move won't go through without them.
          </p>
        </div>

        <div className="flex gap-1.5">
          {[
            ["Today", 0],
            ["Tomorrow", 1],
            ["Day after", 2],
          ].map(([label, days]) => (
            <button
              key={label as string}
              type="button"
              onClick={() => pickQuickDate(days as number)}
              className="flex-1 text-xs px-2 py-1.5 rounded-md border hover:bg-muted transition-colors"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 block">
            <span className="text-[11px] text-muted-foreground">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
          <label className="space-y-1 block">
            <span className="text-[11px] text-muted-foreground">Time</span>
            <input
              type="time"
              value={time}
              step={900}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-[11px] text-muted-foreground">Note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Agenda / what to discuss..."
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-md border hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm || pending}
            onClick={handleConfirm}
            className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50 transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function MeetingChip({
  lead,
  disabled,
  onClick,
}: {
  lead: KanbanLead;
  disabled: boolean;
  onClick: () => void;
}) {
  if (!lead.meeting_datetime) return null;

  const overdue = isOverdue(lead.meeting_datetime);
  const meetingNo = lead.meeting_history.length + 1;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={
        "text-[11px] px-1.5 py-1 rounded-md border transition-colors disabled:opacity-50 text-left w-full " +
        (overdue
          ? "border-red-500/30 text-red-400 bg-red-500/10"
          : "border-cyan-500/30 text-cyan-400 bg-cyan-500/10")
      }
    >
      <span className="block">
        📍 {meetingNo > 1 ? `#${meetingNo} ` : ""}
        {formatMeetingDateTime(lead.meeting_datetime)}
        {overdue ? " · Overdue ⚠️" : ""}
      </span>
      {lead.meeting_note && (
        <span className="block text-muted-foreground truncate max-w-[180px] font-normal">
          {lead.meeting_note}
        </span>
      )}
    </button>
  );
}

function LeadCard({
  lead,
  onStageChange,
  onAssigneeChange,
  onDateChange,
  onRequestMeetingMove,
  onRequestReschedule,
  stages,
  pending,
  assignableUsers,
  canReassign,
  canSelect,
  selected,
  selectionActive,
  onToggleSelect,
}: {
  lead: KanbanLead;
  onStageChange: (id: string, stage: LeadStage) => void;
  onAssigneeChange: (id: string, userId: string) => void;
  onDateChange: (
    id: string,
    field: "last_contact" | "next_followup",
    iso: string
  ) => void;
  onRequestMeetingMove: (leadId: string) => void;
  onRequestReschedule: (leadId: string) => void;
  stages: LeadStage[];
  pending: boolean;
  assignableUsers: AssignableUser[];
  canReassign: boolean;
  canSelect: boolean;
  selected: boolean;
  selectionActive: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const assigneeLocked = !ASSIGNEE_CHANGEABLE_STAGES.includes(lead.stage);
  const [showMove, setShowMove] = useState(false);
  const longPress = useLongPress(() => {
    if (canSelect) onToggleSelect(lead.id);
  });

  return (
    <div
      {...(canSelect ? longPress : {})}
      className={
        "group relative rounded-xl border bg-card p-4 space-y-3 transition-colors " +
        (selected
          ? "border-primary bg-primary/[0.04]"
          : "hover:border-primary/40")
      }
    >
      {/* Selection checkbox — hidden by default, revealed on hover (desktop)
          or once any card is selected (so multi-select stays one-tap after
          the first long-press on mobile). Never shown at all if the current
          user isn't allowed to bulk-act on this lead (members + others' leads). */}
      {canSelect && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(lead.id);
          }}
          aria-label={selected ? "Deselect lead" : "Select lead"}
          className={
            "absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-md border transition-opacity " +
            (selected
              ? "opacity-100 bg-primary border-primary text-primary-foreground"
              : "opacity-0 group-hover:opacity-100 bg-background border-border " +
                (selectionActive ? "opacity-100" : ""))
          }
        >
          {selected && (
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      )}

      {/* Top row — name + move button */}
      <div className="flex items-start justify-between gap-2">
        <div className={"min-w-0" + (canSelect ? " pl-6" : "")}>
          <p className="font-medium text-sm truncate">{lead.name}</p>

          {lead.business_name && (
            <p className="text-xs text-muted-foreground truncate">
              {lead.business_name}
            </p>
          )}

         {lead.phone && (
  <div className="flex items-center gap-1.5 mt-0.5">
    <a
      href={"tel:" + lead.phone}
      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
    >
      {"📞 " + lead.phone}
    </a>
              <a
                href={"https://wa.me/" + toWhatsappNumber(lead.phone)}
                target="_blank"
                rel="noopener noreferrer"
                title="Message on WhatsApp"
                className="shrink-0 text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="currentColor"
                >
                  <path d="M12.04 2c-5.52 0-10 4.48-10 10 0 1.77.46 3.45 1.27 4.9L2 22l5.25-1.38a9.94 9.94 0 0 0 4.79 1.22h.01c5.52 0 10-4.48 10-10s-4.48-10-10-10Zm0 18.2a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.11.82.83-3.03-.2-.31A8.19 8.19 0 1 1 20.2 12a8.2 8.2 0 0 1-8.16 8.2Zm4.5-6.13c-.25-.12-1.45-.71-1.67-.79-.22-.08-.39-.12-.55.12-.16.25-.63.79-.77.95-.14.16-.28.18-.53.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.45-1.37-1.7-.14-.25-.02-.38.11-.5.11-.11.25-.28.37-.42.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.43.06-.66.31-.22.25-.86.85-.86 2.06 0 1.22.89 2.4 1.01 2.56.12.16 1.75 2.67 4.24 3.74.59.26 1.06.41 1.42.52.6.19 1.14.16 1.57.1.48-.07 1.45-.59 1.65-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.47-.28Z" />
                </svg>
              </a>
            </div>
          )}
        </div>

        <button
          onClick={() => setShowMove((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground shrink-0 border rounded px-2 py-0.5 transition-colors"
        >
          Move
        </button>
      </div>

      {/* Deal value + quick dates (left, stacked) / assignee (right) */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col items-start gap-0.5 min-w-0">
          {lead.deal_value != null && (
            <span className="text-xs font-medium text-foreground">
              {"$" + Number(lead.deal_value).toLocaleString()}
            </span>
          )}
          <LastContactChip
            value={lead.last_contact}
            disabled={pending}
            onChange={(iso) => onDateChange(lead.id, "last_contact", iso)}
          />
          {lead.stage === "meeting" && (
            <MeetingChip
              lead={lead}
              disabled={pending}
              onClick={() => onRequestReschedule(lead.id)}
            />
          )}
          <NextFollowupChip
            value={lead.next_followup}
            disabled={pending}
            onChange={(iso) => onDateChange(lead.id, "next_followup", iso)}
          />
        </div>

        {assigneeLocked ? (
          <span
            title="Assignee is locked once a lead leaves Call Pending"
            className="flex items-center gap-1 text-xs text-muted-foreground max-w-[140px]"
          >
            <span className="truncate">🔒 {lead.assignee.name}</span>
          </span>
        ) : (
          <AssigneeDropdown
            currentAssignee={lead.assignee}
            users={canReassign ? assignableUsers : []}
            disabled={pending}
            onSelect={(userId) => onAssigneeChange(lead.id, userId)}
          />
        )}
      </div>

      {/* Stage move dropdown */}
      {showMove && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t">
          {stages
            .filter((s) => s !== lead.stage)
            .map((s) => (
              <button
                key={s}
                disabled={pending}
                onClick={() => {
                  setShowMove(false);
                  if (s === "meeting") {
                    onRequestMeetingMove(lead.id);
                  } else {
                    onStageChange(lead.id, s);
                  }
                }}
                className={
                  "text-xs px-2 py-0.5 rounded-full border transition-opacity " +
                  STAGE_COLORS[s].badge +
                  " disabled:opacity-50"
                }
              >
                {LEAD_STAGE_LABELS[s]}
              </button>
            ))}
        </div>
      )}

      {/* Edit link */}
      <div className="flex justify-end pt-1 border-t">
        <Link
          href={"/crm/" + lead.id}
          className="text-xs text-primary hover:underline shrink-0"
        >
          Edit →
        </Link>
      </div>
    </div>
  );
}

export function KanbanBoard({
  leads: initialLeads,
  stages,
  assignableUsers,
  canReassign,
  currentUserId,
}: KanbanBoardProps) {
  const [items, setItems] = useState(initialLeads);
  const [activeStage, setActiveStage] = useState<LeadStage>(stages[0]);
  const [pending, startTransition] = useTransition();

  // --- Global filters (apply across all 6 stages, not per-stage) ---
  const [assignedToFilter, setAssignedToFilter] = useState<string>("all");
  const [followupFilter, setFollowupFilter] = useState<FollowupFilter>("all");
  const [search, setSearch] = useState("");

  // --- Bulk selection ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectionActive = selectedIds.size > 0;

  // --- Meeting schedule / reschedule popup ---
  const [meetingModal, setMeetingModal] = useState<{
    leadId: string;
    mode: "schedule" | "reschedule";
  } | null>(null);
  const meetingModalLead = meetingModal
    ? items.find((l) => l.id === meetingModal.leadId) ?? null
    : null;

  function toggleSelect(id: string) {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function handleStageChange(leadId: string, newStage: LeadStage) {
    const previous = items;

    setItems((cur) =>
      cur.map((l) =>
        l.id === leadId ? { ...l, stage: newStage } : l
      )
    );

    startTransition(async () => {
      const result = await updateLeadStageAction(leadId, newStage);

      if (result?.error) {
        setItems(previous);
      }
    });
  }

  function handleScheduleMeeting(leadId: string, isoDatetime: string, note: string) {
    const previous = items;

    setItems((cur) =>
      cur.map((l) =>
        l.id === leadId
          ? {
              ...l,
              stage: "meeting" as LeadStage,
              meeting_datetime: isoDatetime,
              meeting_note: note || null,
            }
          : l
      )
    );
    setMeetingModal(null);

    startTransition(async () => {
      const result = await updateLeadStageAction(leadId, "meeting", {
        datetime: isoDatetime,
        note,
      });
      if (result?.error) {
        setItems(previous);
      }
    });
  }

  function handleRescheduleMeeting(leadId: string, isoDatetime: string, note: string) {
    const previous = items;

    setItems((cur) =>
      cur.map((l) => {
        if (l.id !== leadId) return l;
        const prevHistory = l.meeting_datetime
          ? [
              ...l.meeting_history,
              {
                datetime: l.meeting_datetime,
                note: l.meeting_note,
                logged_at: new Date().toISOString(),
              },
            ]
          : l.meeting_history;
        return {
          ...l,
          meeting_datetime: isoDatetime,
          meeting_note: note || null,
          meeting_history: prevHistory,
        };
      })
    );
    setMeetingModal(null);

    startTransition(async () => {
      const result = await rescheduleMeetingAction(leadId, isoDatetime, note);
      if (result?.error) {
        setItems(previous);
      }
    });
  }

  function handleAssigneeChange(leadId: string, userId: string) {
    const previous = items;
    const newAssignee = assignableUsers.find((u) => u.id === userId);
    if (!newAssignee) return;

    setItems((cur) =>
      cur.map((l) =>
        l.id === leadId ? { ...l, assignee: newAssignee } : l
      )
    );

    startTransition(async () => {
      const result = await updateLeadAssigneeAction(leadId, userId);

      if (result?.error) {
        setItems(previous);
      }
    });
  }

  function handleDateChange(
    leadId: string,
    field: "last_contact" | "next_followup",
    value: string
  ) {
    const previous = items;

    setItems((cur) =>
      cur.map((l) => (l.id === leadId ? { ...l, [field]: value } : l))
    );

    startTransition(async () => {
      const result = await updateLeadAction(leadId, { [field]: value });

      if (result?.error) {
        setItems(previous);
      }
    });
  }

  function handleBulkMove(newStage: LeadStage) {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const previous = items;

    setItems((cur) =>
      cur.map((l) => (ids.includes(l.id) ? { ...l, stage: newStage } : l))
    );
    clearSelection();

    startTransition(async () => {
      const result = await bulkUpdateLeadStageAction(ids, newStage);
      if (result?.error) {
        setItems(previous);
      }
    });
  }

  function handleBulkAssign(userId: string) {
    const ids = Array.from(selectedIds);
    const newAssignee = assignableUsers.find((u) => u.id === userId);
    if (!ids.length || !newAssignee) return;
    const previous = items;

    setItems((cur) =>
      cur.map((l) => (ids.includes(l.id) ? { ...l, assignee: newAssignee } : l))
    );
    clearSelection();

    startTransition(async () => {
      const result = await bulkUpdateLeadAssigneeAction(ids, userId);
      if (result?.error) {
        setItems(previous);
      }
    });
  }

  // A member can only ever bulk-act on their own leads; admins/founders can
  // select anything. This mirrors the server-side permission check exactly.
  function canSelectLead(lead: KanbanLead) {
    if (canReassign) return true; // not a member
    return lead.assignee.id === currentUserId;
  }

  const filteredItems = items.filter((l) => {
    if (assignedToFilter !== "all" && l.assignee.id !== assignedToFilter) {
      return false;
    }

    if (followupFilter !== "all") {
      const bucket = getFollowupBucket(l.next_followup);
      if (followupFilter === "not_set" && bucket !== "not_set") return false;
      if (followupFilter === "overdue" && bucket !== "overdue") return false;
      if (followupFilter === "due_today" && bucket !== "due_today") return false;
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const haystack = [l.name, l.business_name ?? "", l.phone ?? ""]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });

  const visibleLeads = filteredItems.filter((l) => l.stage === activeStage);

  const filtersActive =
    assignedToFilter !== "all" || followupFilter !== "all" || search.trim() !== "";

  const colors = STAGE_COLORS[activeStage];

  return (
    <div className="space-y-4">
      {/* Sticky filter bar + selection toolbar — pins just below the main
          header (top-14 matches the header's h-14) so both stay visible
          while scrolling through a long leads list. */}
      <div className="sticky top-14 z-20 -mx-4 px-4 pb-3 pt-3 bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80 border-b space-y-2">
        {/* Global filters — apply across all 6 stages at once */}
        <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, business, phone..."
          className="w-full sm:w-56 rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
        />

        <select
          value={assignedToFilter}
          onChange={(e) => setAssignedToFilter(e.target.value)}
          className="rounded-lg border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">All assignees</option>
          {assignableUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>

        <select
          value={followupFilter}
          onChange={(e) => setFollowupFilter(e.target.value as FollowupFilter)}
          className="rounded-lg border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">All follow-ups</option>
          <option value="overdue">Overdue</option>
          <option value="due_today">Due today</option>
          <option value="not_set">Not set</option>
        </select>

        {filtersActive && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setAssignedToFilter("all");
              setFollowupFilter("all");
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Bulk selection toolbar */}
      {selectionActive && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">
            {selectedIds.size} lead{selectedIds.size !== 1 ? "s" : ""} selected
          </span>

          <div className="flex items-center gap-1.5 flex-wrap">
            <select
              disabled={pending}
              value=""
              onChange={(e) => {
                if (e.target.value) handleBulkMove(e.target.value as LeadStage);
              }}
              className="rounded-md border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            >
              <option value="" disabled>
                Move to...
              </option>
              {stages.map((s) => (
                <option key={s} value={s}>
                  {LEAD_STAGE_LABELS[s]}
                </option>
              ))}
            </select>

            {canReassign && (
              <select
                disabled={pending}
                value=""
                onChange={(e) => {
                  if (e.target.value) handleBulkAssign(e.target.value);
                }}
                className="rounded-md border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              >
                <option value="" disabled>
                  Assign to...
                </option>
                {assignableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={clearSelection}
              className="text-xs text-muted-foreground hover:text-foreground border rounded-md px-2 py-1 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
        {stages.map((stage) => {
          const count = filteredItems.filter((l) => l.stage === stage).length;
          const isActive = stage === activeStage;
          const c = STAGE_COLORS[stage];

          return (
            <button
              key={stage}
              onClick={() => setActiveStage(stage)}
              className={
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all border " +
                (isActive
                  ? c.tab + " bg-card border-current"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50")
              }
            >
              <span
                className={
                  "h-2 w-2 rounded-full " +
                  c.dot +
                  (isActive ? "" : " opacity-50")
                }
              />

              {LEAD_STAGE_LABELS[stage]}

              <span
                className={
                  "rounded-full px-1.5 py-0.5 text-xs font-medium border " +
                  (isActive
                    ? c.badge
                    : "bg-muted text-muted-foreground")
                }
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active stage header */}
      <div className="flex items-center justify-between">
        <h2 className={"font-semibold " + colors.tab}>
          {LEAD_STAGE_LABELS[activeStage]}
        </h2>

        <span className="text-sm text-muted-foreground">
          {visibleLeads.length +
            " lead" +
            (visibleLeads.length !== 1 ? "s" : "")}
        </span>
      </div>

      {/* Leads list */}
      {visibleLeads.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {filtersActive ? "No leads match these filters." : "No leads in this stage."}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleLeads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onStageChange={handleStageChange}
              onAssigneeChange={handleAssigneeChange}
              onDateChange={handleDateChange}
              onRequestMeetingMove={(leadId) =>
                setMeetingModal({ leadId, mode: "schedule" })
              }
              onRequestReschedule={(leadId) =>
                setMeetingModal({ leadId, mode: "reschedule" })
              }
              stages={stages}
              pending={pending}
              assignableUsers={assignableUsers}
              canReassign={canReassign}
              canSelect={canSelectLead(lead)}
              selected={selectedIds.has(lead.id)}
              selectionActive={selectionActive}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      <MeetingModal
        open={meetingModal !== null}
        mode={meetingModal?.mode ?? "schedule"}
        initialDatetime={meetingModal?.mode === "reschedule" ? meetingModalLead?.meeting_datetime ?? null : null}
        initialNote={meetingModal?.mode === "reschedule" ? meetingModalLead?.meeting_note ?? null : null}
        pending={pending}
        onClose={() => setMeetingModal(null)}
        onConfirm={(isoDatetime, note) => {
          if (!meetingModal) return;
          if (meetingModal.mode === "schedule") {
            handleScheduleMeeting(meetingModal.leadId, isoDatetime, note);
          } else {
            handleRescheduleMeeting(meetingModal.leadId, isoDatetime, note);
          }
        }}
      />
    </div>
  );
}