"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FineStatusTabs, type FineTabItem } from "@/components/dashboard/fine-status-tabs";
import { TeamFines, type TeamFineUser } from "@/components/dashboard/team-fines";
import { StrikesPanel, type StrikeRow } from "@/components/dashboard/strikes-panel";
import { PaymentReview, type PaymentReviewItem } from "@/components/dashboard/payment-review";
import { FineAmountSetting } from "@/components/dashboard/fine-amount-setting";

export function FinesRewardsClient({
  role,
  totalDue,
  totalFineCount,
  myActiveStrikeCount,
  myFines,
  teamUsers,
  strikes,
  paymentReview,
  fineAmount,
}: {
  role: "super_admin" | "admin" | "member";
  totalDue: number;
  totalFineCount: number;
  myActiveStrikeCount: number;
  myFines: FineTabItem[];
  teamUsers: TeamFineUser[];
  strikes: StrikeRow[];
  paymentReview: PaymentReviewItem[];
  fineAmount: number;
}) {
  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "super_admin" || role === "admin";

  const [mainTab, setMainTab] = useState<"fine" | "rewards">("fine");
  const [scope, setScope] = useState<"mine" | "team">("mine");

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className="flex gap-1 rounded-xl border p-1.5">
          {(["fine", "rewards"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setMainTab(t)}
              className={`text-base px-8 py-2.5 rounded-lg capitalize font-medium transition-colors ${
                mainTab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/5"
              }`}
            >
              {t === "fine" ? "Fine" : "Rewards"}
            </button>
          ))}
        </div>
      </div>

      {mainTab === "rewards" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rewards</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Coming soon.</p>
          </CardContent>
        </Card>
      )}

      {mainTab === "fine" && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">My fines</CardTitle>
              <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/30 tracking-wide">
                {myActiveStrikeCount} ACTIVE STRIKE{myActiveStrikeCount === 1 ? "" : "S"}
              </span>
            </CardHeader>
            <CardContent>
              <div className="flex items-stretch gap-6">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Total due</p>
                  <p className="text-2xl font-bold">₹{totalDue.toLocaleString()}</p>
                </div>
                <div className="w-px bg-border" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Total fines</p>
                  <p className="text-2xl font-bold">{totalFineCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {isSuperAdmin && <StrikesPanel strikes={strikes} />}

          {isAdmin ? (
            <div className="space-y-3">
              <div className="flex justify-center">
                <div className="flex gap-1 rounded-xl border p-1.5">
                  {(["mine", "team"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setScope(s)}
                      className={`text-sm px-6 py-2 rounded-lg font-medium transition-colors ${
                        scope === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/5"
                      }`}
                    >
                      {s === "mine" ? "My Fines" : "Team Fines"}
                    </button>
                  ))}
                </div>
              </div>

              {scope === "mine" && <FineStatusTabs fines={myFines} canPay />}
              {scope === "team" && <TeamFines users={teamUsers} isSuperAdmin={isSuperAdmin} />}
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-white/70">My Fines</h3>
              <FineStatusTabs fines={myFines} canPay />
            </div>
          )}

          {isSuperAdmin && <PaymentReview items={paymentReview} />}

          {isSuperAdmin && <FineAmountSetting fineAmount={fineAmount} />}
        </div>
      )}
    </div>
  );
}