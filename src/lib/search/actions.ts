"use server";

import "server-only";

import { requireUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export interface SearchResultItem {
  id: string;
  type: "task" | "lead" | "user";
  title: string;
  subtitle: string | null;
  href: string;
}

// Global search across Tasks, CRM Leads, and (admin-only) Users.
// Members only ever see their own tasks/leads — same visibility rules
// used elsewhere in the app (see src/lib/crm/actions.ts).
export async function globalSearchAction(rawQuery: string): Promise<SearchResultItem[]> {
  const query = rawQuery.trim();
  if (query.length < 2) return [];

  const profile = await requireUserProfile();
  const supabase = createClient();
  const isPrivileged = profile.role === "admin" || profile.role === "super_admin";
  const like = `%${query}%`;

  const tasksQuery = supabase
    .from("tasks")
    .select("id, title, status")
    .ilike("title", like)
    .limit(5);
  if (!isPrivileged) {
    tasksQuery.or(`assigned_to.eq.${profile.id},assigned_by.eq.${profile.id}`);
  }

  const leadsQuery = supabase
    .from("leads")
    .select("id, name, business_name, phone, stage")
    .or(
      `name.ilike.${like},business_name.ilike.${like},phone.ilike.${like},email.ilike.${like}`
    )
    .limit(5);
  if (!isPrivileged) {
    leadsQuery.eq("assigned_to", profile.id);
  }

  const usersQuery = isPrivileged
    ? supabase
        .from("users")
        .select("id, name, email, role")
        .or(`name.ilike.${like},email.ilike.${like}`)
        .limit(5)
    : null;

  const [tasksRes, leadsRes, usersRes] = await Promise.all([
    tasksQuery,
    leadsQuery,
    usersQuery ?? Promise.resolve(null),
  ]);

  const results: SearchResultItem[] = [];

  for (const t of (tasksRes.data ?? []) as { id: string; title: string; status: string }[]) {
    results.push({
      id: t.id,
      type: "task",
      title: t.title,
      subtitle: t.status.replace(/_/g, " "),
      href: `/tasks/${t.id}`,
    });
  }

  for (const l of (leadsRes.data ?? []) as {
    id: string;
    name: string;
    business_name: string | null;
    phone: string | null;
    stage: string;
  }[]) {
    results.push({
      id: l.id,
      type: "lead",
      title: l.business_name || l.name,
      subtitle: l.phone || l.stage.replace(/_/g, " "),
      href: `/crm/${l.id}`,
    });
  }

  if (usersRes) {
    for (const u of (usersRes.data ?? []) as {
      id: string;
      name: string;
      email: string;
      role: string;
    }[]) {
      results.push({
        id: u.id,
        type: "user",
        title: u.name || u.email,
        subtitle: u.role.replace(/_/g, " "),
        href: `/admin/users`,
      });
    }
  }

  return results;
}