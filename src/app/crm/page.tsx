import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { KanbanBoard } from "@/components/crm/kanban-board";
import { CreateLeadForm } from "@/components/crm/create-lead-form";
import { LEAD_STAGES } from "@/lib/types/crm";

export default async function CrmPage() {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, name, business_name, deal_value, stage, assigned_to")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <p className="text-destructive">Failed to load leads: {error.message}</p>
    );
  }

  const assigneeIds = Array.from(
    new Set((leads ?? []).map((l) => l.assigned_to))
  );
  const { data: users } = await supabase
    .from("users")
    .select("id, name")
    .in("id", assigneeIds.length ? assigneeIds : ["00000000-0000-0000-0000-000000000000"]);

  const userMap = new Map((users ?? []).map((u) => [u.id, u.name]));

  const kanbanLeads = (leads ?? []).map((lead) => ({
    id: lead.id,
    name: lead.name,
    business_name: lead.business_name,
    deal_value: lead.deal_value,
    stage: lead.stage,
    assignee: { name: userMap.get(lead.assigned_to) ?? "Unknown" },
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">CRM</h1>
        <p className="text-sm text-muted-foreground">
          {profile.role === "member"
            ? "Your leads pipeline"
            : "Team leads pipeline"}
        </p>
      </div>

      {profile.role !== "member" && <CreateLeadForm />}

      <KanbanBoard leads={kanbanLeads} stages={LEAD_STAGES} />
    </div>
  );
}
