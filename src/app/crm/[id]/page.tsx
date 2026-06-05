import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getAssignableUsers } from "@/lib/crm/actions";
import { LeadEditForm } from "@/components/crm/lead-edit-form";
import { LEAD_STAGE_LABELS, type LeadStage } from "@/lib/types/crm";

interface LeadDetailPageProps {
  params: { id: string };
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const { data: lead, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !lead) {
    notFound();
  }

  const { data: audit } = await supabase
    .from("lead_audit")
    .select("id, field_changed, old_value, new_value, changed_at, changed_by")
    .eq("lead_id", params.id)
    .order("changed_at", { ascending: false });

  const changerIds = Array.from(
    new Set((audit ?? []).map((a) => a.changed_by))
  );
  const { data: changers } = await supabase
    .from("users")
    .select("id, name")
    .in(
      "id",
      changerIds.length ? changerIds : ["00000000-0000-0000-0000-000000000000"]
    );

  const changerMap = new Map((changers ?? []).map((u) => [u.id, u.name]));
  const assignees = profile.role === "member" ? [] : await getAssignableUsers();

  return (
    <div className="space-y-8">
      <div>
        <Link href="/crm" className="text-sm text-muted-foreground hover:underline">
          ← Back to CRM
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {lead.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {LEAD_STAGE_LABELS[lead.stage as LeadStage]}
        </p>
      </div>

      <section className="rounded-xl border p-6">
        <h2 className="mb-4 font-medium">Lead details</h2>
        <LeadEditForm
          lead={lead}
          assignedTo={lead.assigned_to}
          canAssign={profile.role !== "member"}
          assignees={assignees.map((u) => ({ id: u.id, name: u.name }))}
        />
      </section>

      <section>
        <h2 className="mb-4 font-medium">Audit trail</h2>
        <ol className="space-y-3">
          {(audit ?? []).length === 0 ? (
            <li className="text-sm text-muted-foreground">No changes recorded.</li>
          ) : (
            (audit ?? []).map((entry) => (
              <li key={entry.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">
                  {changerMap.get(entry.changed_by) ?? "Unknown"} changed{" "}
                  <span className="font-mono">{entry.field_changed}</span>
                </p>
                <p className="text-muted-foreground">
                  {entry.old_value ?? "—"} → {entry.new_value ?? "—"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(entry.changed_at).toLocaleString()}
                </p>
              </li>
            ))
          )}
        </ol>
      </section>
    </div>
  );
}
