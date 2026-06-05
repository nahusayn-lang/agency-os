import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { AuditAction } from "@/lib/types/database";

interface AuditEventInput {
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  reason?: string | null;
}

export async function writeAuditEvent(input: AuditEventInput): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin.from("audit_log").insert({
    user_id: input.userId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    reason: input.reason ?? null,
  });

  if (error) {
    throw new Error(`Failed to write audit log: ${error.message}`);
  }
}
