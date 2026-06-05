import type { PerformanceScore } from "@/lib/types/performance";
import type { PerformanceScoreOverridePayload } from "@/lib/types/performance";
import { PerformanceScoreOverrideModal } from "@/components/performance/performance-score-override-modal";

interface PerformanceScoreSectionProps {
  score: PerformanceScore | null;
  override: PerformanceScoreOverridePayload | null;
  showOverrideModal: boolean;
  targetUserId: string;
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value.toFixed(2)}</span>
    </div>
  );
}

export function PerformanceScoreSection({
  score,
  override,
  showOverrideModal,
  targetUserId,
}: PerformanceScoreSectionProps) {
  if (!score) {
    return (
      <p className="text-sm text-muted-foreground">
        No performance score has been calculated for this period yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-muted-foreground">
          Period {score.period_start} — {score.period_end}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {score.total_score.toFixed(2)}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            calculated total
          </span>
        </p>
      </div>

      <div className="space-y-2 rounded-lg border p-4">
        <p className="text-sm font-medium">Component scores (immutable)</p>
        <ScoreRow label="Task (40%)" value={score.task_score} />
        <ScoreRow label="Attendance (20%)" value={score.attendance_score} />
        <ScoreRow label="Lead (20%)" value={score.lead_score} />
        <ScoreRow label="Report (20%)" value={score.report_score} />
      </div>

      {override && (
        <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <p className="text-sm font-medium">God mode override (display only)</p>
          <ScoreRow label="Override total" value={override.total_score} />
          <ScoreRow label="Task" value={override.task_score} />
          <ScoreRow label="Attendance" value={override.attendance_score} />
          <ScoreRow label="Lead" value={override.lead_score} />
          <ScoreRow label="Report" value={override.report_score} />
          {override.note && (
            <p className="text-sm text-muted-foreground">{override.note}</p>
          )}
        </div>
      )}

      {showOverrideModal && (
        <PerformanceScoreOverrideModal
          targetUserId={targetUserId}
          periodStart={score.period_start}
          periodEnd={score.period_end}
          current={score}
        />
      )}
    </div>
  );
}
