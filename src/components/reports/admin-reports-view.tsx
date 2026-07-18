import { getAllReportsForAdmin } from "@/lib/reports/actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { ReportWithUser } from "@/lib/types/reports";

interface AdminReportsViewProps { memberId?: string; dateFilter?: string }

export async function AdminReportsView({ memberId, dateFilter }: AdminReportsViewProps) {
  const reports: ReportWithUser[] = await getAllReportsForAdmin(memberId, dateFilter);
  if (!reports || reports.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">No reports found.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reports.map((report) => (
        <Card key={report.id} className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-semibold">{report.user?.name || "Unknown"}</p>
              <p className="text-sm text-muted-foreground">{report.user?.email}</p>
            </div>
              <Badge variant="outline">{formatDate(report.created_at)}</Badge>
              <p className="mt-1 text-sm">{report.what_i_did_today}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground">Completed work</h3>
              <p className="mt-1 text-sm">{report.completed_work}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground">Pending work</h3>
              <p className="mt-1 text-sm">{report.pending_work}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground">Blockers</h3>
              <p className="mt-1 text-sm">{report.blockers}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
