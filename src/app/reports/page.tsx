import { requireUserProfile } from "@/lib/auth/session";
import { CreateReportForm } from "@/components/reports/create-report-form";
import { ReportsList } from "@/components/reports/reports-list";
import { AdminReportsView } from "@/components/reports/admin-reports-view";

export default async function ReportsPage() {
  const profile = await requireUserProfile();
  const isMember = profile.role === "member";

  return (
    <div className="space-y-12">
      <section>
        <h2 className="mb-6 text-2xl font-bold">Daily Reports</h2>
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1"><CreateReportForm /></div>
          <div className="lg:col-span-2"><ReportsList userId={profile.id} /></div>
        </div>
      </section>

      {!isMember && (
        <section>
          <h2 className="mb-6 text-2xl font-bold">Team Reports Review</h2>
          <AdminReportsView />
        </section>
      )}
    </div>
  );
}
