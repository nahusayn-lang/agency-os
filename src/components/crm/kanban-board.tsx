"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateLeadStageAction } from "@/lib/crm/actions";
import { LEAD_STAGE_LABELS, type LeadStage } from "@/lib/types/crm";

export interface KanbanLead {
  id: string;
  name: string;
  business_name: string | null;
  phone: string | null;
  deal_value: number | null;
  stage: LeadStage;
  assignee: { name: string };
}

interface KanbanBoardProps {
  leads: KanbanLead[];
  stages: LeadStage[];
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

function LeadCard({
  lead,
  onStageChange,
  stages,
  pending,
}: {
  lead: KanbanLead;
  onStageChange: (id: string, stage: LeadStage) => void;
  stages: LeadStage[];
  pending: boolean;
}) {
  const [showMove, setShowMove] = useState(false);
  const colors = STAGE_COLORS[lead.stage];

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 hover:border-primary/40 transition-colors">
      {/* Top row — name + move button */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
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

      {/* Deal value + assignee */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {lead.deal_value != null ? (
          <span className="text-xs font-medium text-foreground">
            {"$" + Number(lead.deal_value).toLocaleString()}
          </span>
        ) : (
          <span />
        )}

        <span className="text-xs text-muted-foreground">
          {lead.assignee.name}
        </span>
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
                  onStageChange(lead.id, s);
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
      <div className="flex items-center justify-between pt-1 border-t">
        <span className={"flex items-center gap-1.5 text-xs " + colors.tab}>
          <span className={"h-1.5 w-1.5 rounded-full " + colors.dot} />
          {LEAD_STAGE_LABELS[lead.stage]}
        </span>

        <Link
          href={"/crm/" + lead.id}
          className="text-xs text-primary hover:underline"
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
}: KanbanBoardProps) {
  const [items, setItems] = useState(initialLeads);
  const [activeStage, setActiveStage] = useState<LeadStage>(stages[0]);
  const [pending, startTransition] = useTransition();

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

  const visibleLeads = items.filter(
    (l) => l.stage === activeStage
  );

  const colors = STAGE_COLORS[activeStage];

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
        {stages.map((stage) => {
          const count = items.filter((l) => l.stage === stage).length;
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
          No leads in this stage.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleLeads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onStageChange={handleStageChange}
              stages={stages}
              pending={pending}
            />
          ))}
        </div>
      )}
    </div>
  );
}