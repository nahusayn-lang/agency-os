import { requireUserProfile } from "@/lib/auth/session";
import { CreateReportForm } from "@/components/reports/create-report-form";
import { ReportsTabs } from "@/components/reports/reports-tabs";
import { getReportsForMember, getAllReportsForAdmin } from "@/lib/reports/actions";
import type { ReportWithUser } from "@/lib/types/reports";

export default async function ReportsPage() {
  const profile = await requireUserProfile();
  const isMember = profile.role === "member";

  const myReports = (await getReportsForMember(profile.id)) as ReportWithUser[];

  const teamReports = isMember
    ? null
    : ((await getAllReportsForAdmin(undefined, undefined, { excludeSelf: true })) as ReportWithUser[]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Daily Reports</h2>
      <ReportsTabs
        createForm={<CreateReportForm />}
        myReports={myReports}
        teamReports={teamReports}
      />
    </div>
  );
}