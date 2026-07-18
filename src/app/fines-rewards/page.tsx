import { requireUserProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFineAmount } from "@/lib/services/strike-fine-engine";
import { FinesRewardsClient } from "@/components/dashboard/fines-rewards-client";
import type { FineTabItem } from "@/components/dashboard/fine-status-tabs";
import type { TeamFineUser } from "@/components/dashboard/team-fines";
import type { StrikeRow } from "@/components/dashboard/strikes-panel";
import type { PaymentReviewItem } from "@/components/dashboard/payment-review";

export default async function FinesRewardsPage() {
  const profile = await requireUserProfile();
  const role = (profile.role ?? "member") as "super_admin" | "admin" | "member";
  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "super_admin" || role === "admin";
  const admin = createAdminClient();

  // All fines (everyone's, if admin) — also fetching strikes.reason to
  // attach the category.
  const financialQuery = isAdmin
    ? admin
        .from("fines")
        .select("id, user_id, amount, status, deadline, proof_url, payment_comment, users:user_id(name)")
        .order("created_at", { ascending: false })
    : admin
        .from("fines")
        .select("id, user_id, amount, status, deadline, proof_url, payment_comment, users:user_id(name)")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

  const { data: finesRaw } = await financialQuery;
  const allFines = finesRaw ?? [];

  const fineIds = allFines.map((f) => f.id);
  const { data: linkedStrikes } = await admin
    .from("strikes")
    .select("fine_id, reason")
    .in("fine_id", fineIds.length ? fineIds : ["00000000-0000-0000-0000-000000000000"]);

  const categoryByFineId = new Map<string, string>();
  (linkedStrikes ?? []).forEach((s) => {
    if (s.fine_id && !categoryByFineId.has(s.fine_id)) categoryByFineId.set(s.fine_id, s.reason);
  });

  function toFineTabItem(f: (typeof allFines)[number]): FineTabItem {
    return {
      id: f.id,
      amount: f.amount,
      status: f.status,
      deadline: f.deadline,
      proof_url: f.proof_url,
      payment_comment: f.payment_comment,
      category: categoryByFineId.get(f.id) ?? "uncategorized",
    };
  }

  const myFines: FineTabItem[] = allFines
    .filter((f) => f.user_id === profile.id)
    .map(toFineTabItem);

  const totalDue = myFines
    .filter((f) => f.status === "pending" || f.status === "submitted")
    .reduce((sum, f) => sum + Number(f.amount), 0);

  // My own "remaining" strikes — only those not yet converted into a fine
  // (fine_id null) and not removed. Every 3 strikes becomes 1 fine
  // (checkAndCreateFine), so this count always stays between 0-2 (once a
  // fine is created, the batch of 3 is consumed).
  const { count: myActiveStrikeCount } = await admin
    .from("strikes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("is_removed", false)
    .is("fine_id", null);

  // Team Fines: everyone's fines, excluding the founder's own name from
  // this list (their own record is already shown in "My Fines").
  let teamUsers: TeamFineUser[] = [];
  if (isAdmin) {
    const byUser = new Map<string, TeamFineUser>();
    allFines
      .filter((f) => f.user_id !== profile.id)
      .forEach((f) => {
        const name = (f.users as unknown as { name: string } | null)?.name ?? "Unknown";
        if (!byUser.has(f.user_id)) byUser.set(f.user_id, { userId: f.user_id, userName: name, fines: [] });
        byUser.get(f.user_id)!.fines.push(toFineTabItem(f));
      });
    teamUsers = Array.from(byUser.values()).sort((a, b) => a.userName.localeCompare(b.userName));
  }

  // Payment Review — everyone's "submitted" fines, including the founder's own.
  let paymentReview: PaymentReviewItem[] = [];
  let strikes: StrikeRow[] = [];
  let fineAmount = 149;

  if (isSuperAdmin) {
    fineAmount = await getFineAmount();

    paymentReview = allFines
      .filter((f) => f.status === "submitted")
      .map((f) => ({
        id: f.id,
        user_name:
          f.user_id === profile.id
            ? `${profile.name} (aap)`
            : (f.users as unknown as { name: string } | null)?.name ?? "Unknown",
        amount: f.amount,
        deadline: f.deadline,
        proof_url: f.proof_url,
        payment_comment: f.payment_comment,
      }));

    const { data: strikesRaw } = await admin
      .from("strikes")
      .select("id, reason, is_removed, created_at, users:user_id(name)")
      .order("created_at", { ascending: false });

    strikes = (strikesRaw ?? []).map((s) => ({
      id: s.id,
      user_name: (s.users as unknown as { name: string } | null)?.name ?? "Unknown",
      reason: s.reason,
      is_removed: s.is_removed,
      created_at: s.created_at,
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Fine &amp; Rewards</h1>
      </div>

      <FinesRewardsClient
        role={role}
        totalDue={totalDue}
        totalFineCount={myFines.length}
        myActiveStrikeCount={myActiveStrikeCount ?? 0}
        myFines={myFines}
        teamUsers={teamUsers}
        strikes={strikes}
        paymentReview={paymentReview}
        fineAmount={fineAmount}
      />
    </div>
  );
}