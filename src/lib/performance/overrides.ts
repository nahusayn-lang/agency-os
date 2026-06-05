import {
  PERFORMANCE_OVERRIDE_ACTION,
  type PerformanceScoreOverridePayload,
} from "@/lib/types/performance";

export function buildOverrideTargetEntity(
  userId: string,
  periodStart: string
): string {
  return `user:${userId}:period:${periodStart}`;
}

export function parseOverridePayload(
  reason: string
): PerformanceScoreOverridePayload | null {
  try {
    const parsed = JSON.parse(reason) as PerformanceScoreOverridePayload;
    if (
      typeof parsed.task_score === "number" &&
      typeof parsed.attendance_score === "number" &&
      typeof parsed.lead_score === "number" &&
      typeof parsed.report_score === "number" &&
      typeof parsed.total_score === "number"
    ) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export function findLatestScoreOverride(
  overrides: Array<{
    action: string;
    target_entity: string;
    reason: string;
    created_at: string;
  }>,
  userId: string,
  periodStart: string
) {
  const target = buildOverrideTargetEntity(userId, periodStart);
  const match = overrides.find(
    (row) =>
      row.action === PERFORMANCE_OVERRIDE_ACTION &&
      row.target_entity === target
  );
  if (!match) {
    return null;
  }
  const payload = parseOverridePayload(match.reason);
  if (!payload) {
    return null;
  }
  return { ...match, payload };
}
