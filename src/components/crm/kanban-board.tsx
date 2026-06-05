"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { updateLeadStageAction } from "@/lib/crm/actions";
import { LEAD_STAGE_LABELS, type LeadStage } from "@/lib/types/crm";

export interface KanbanLead {
  id: string;
  name: string;
  business_name: string | null;
  deal_value: number | null;
  stage: LeadStage;
  assignee: { name: string };
}

interface KanbanBoardProps {
  leads: KanbanLead[];
  stages: LeadStage[];
}

function LeadCard({ lead }: { lead: KanbanLead }) {
  return (
    <Link
      href={`/crm/${lead.id}`}
      className="block rounded-lg border bg-card p-3 shadow-sm transition hover:border-primary/50"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-sm font-medium">{lead.name}</p>
      {lead.business_name && (
        <p className="text-xs text-muted-foreground">{lead.business_name}</p>
      )}
      {lead.deal_value != null && (
        <p className="mt-1 text-xs">
          ${Number(lead.deal_value).toLocaleString()}
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">{lead.assignee.name}</p>
    </Link>
  );
}

function DraggableLead({ lead }: { lead: KanbanLead }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={isDragging ? "opacity-40" : ""}
    >
      <LeadCard lead={lead} />
    </div>
  );
}

function KanbanColumn({
  stage,
  leads,
}: {
  stage: LeadStage;
  leads: KanbanLead[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={`min-w-0 rounded-xl border p-3 ${
        isOver ? "border-primary bg-primary/5" : "bg-muted/20"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="truncate text-sm font-medium leading-tight">
          {LEAD_STAGE_LABELS[stage]}
        </h3>
        <span className="text-xs text-muted-foreground">{leads.length}</span>
      </div>
      <div className="min-h-[120px] space-y-2">
        {leads.map((lead) => (
          <DraggableLead key={lead.id} lead={lead} />
        ))}
      </div>
    </div>
  );
}

export function KanbanBoard({ leads: initialLeads, stages }: KanbanBoardProps) {
  const [items, setItems] = useState(initialLeads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const leadId = String(active.id);
    const newStage = String(over.id) as LeadStage;

    if (!stages.includes(newStage)) return;

    const lead = items.find((l) => l.id === leadId);
    if (!lead || lead.stage === newStage) return;

    const previous = items;
    setItems((current) =>
      current.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l))
    );

    startTransition(async () => {
      const result = await updateLeadStageAction(leadId, newStage);
      if (result?.error) {
        setItems(previous);
      }
    });
  }

  const activeLead = activeId
    ? items.find((lead) => lead.id === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 gap-3 pb-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stages.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            leads={items.filter((lead) => lead.stage === stage)}
          />
        ))}
      </div>
      <DragOverlay>
        {activeLead ? (
          <div className="opacity-90">
            <LeadCard lead={activeLead} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
