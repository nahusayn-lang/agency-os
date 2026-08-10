"use client";

import { useTransition } from "react";
import { updateLeadAction } from "@/lib/crm/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ASSIGNEE_CHANGEABLE_STAGES,
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  type LeadStage,
} from "@/lib/types/crm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LeadEditFormProps {
  lead: {
    id: string;
    name: string;
    business_name: string | null;
    phone: string | null;
    email: string | null;
    stage: LeadStage;
    deal_value: number | null;
    notes: string | null;
    last_contact: string | null;
    next_followup: string | null;
  };
  canAssign: boolean;
  assignees: Array<{ id: string; name: string }>;
  assignedTo: string;
}

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export function LeadEditForm({
  lead,
  canAssign,
  assignees,
  assignedTo,
}: LeadEditFormProps) {
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateLeadAction(lead.id, {
        name: String(formData.get("name") ?? ""),
        business_name: String(formData.get("business_name") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        email: String(formData.get("email") ?? ""),
        stage: String(formData.get("stage") ?? "") as LeadStage,
        deal_value: String(formData.get("deal_value") ?? ""),
        notes: String(formData.get("notes") ?? ""),
        last_contact: String(formData.get("last_contact") ?? ""),
        next_followup: String(formData.get("next_followup") ?? ""),
        ...(canAssign
          ? { assigned_to: String(formData.get("assigned_to") ?? "") }
          : {}),
      });
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={lead.name} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="business_name">Business name</Label>
        <Input
          id="business_name"
          name="business_name"
          defaultValue={lead.business_name ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={lead.email ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" defaultValue={lead.phone ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="stage">Stage</Label>
        <Select name="stage" defaultValue={lead.stage}>
          <SelectTrigger id="stage" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEAD_STAGES.filter((stage) => stage !== "meeting" || lead.stage === "meeting").map(
              (stage) => (
                <SelectItem key={stage} value={stage}>
                  {LEAD_STAGE_LABELS[stage]}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
        {lead.stage !== "meeting" && (
          <p className="text-xs text-muted-foreground">
            Use the Move button on the CRM board to set &quot;Meeting&quot; — date/time is required.
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="deal_value">Deal value</Label>
        <Input
          id="deal_value"
          name="deal_value"
          type="number"
          step="0.01"
          defaultValue={lead.deal_value ?? ""}
        />
      </div>
      {canAssign && (
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="assigned_to">Assigned to</Label>
          {ASSIGNEE_CHANGEABLE_STAGES.includes(lead.stage) ? (
            <Select name="assigned_to" defaultValue={assignedTo}>
              <SelectTrigger id="assigned_to" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assignees.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
              🔒 {assignees.find((u) => u.id === assignedTo)?.name ?? "Locked"} — locked past Call Pending
            </p>
          )}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="last_contact">Last contact</Label>
        <Input
          id="last_contact"
          name="last_contact"
          type="datetime-local"
          defaultValue={toLocalInputValue(lead.last_contact)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="next_followup">Next follow-up</Label>
        <Input
          id="next_followup"
          name="next_followup"
          type="datetime-local"
          defaultValue={toLocalInputValue(lead.next_followup)}
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={lead.notes ?? ""}
        />
      </div>
      <div className="md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}