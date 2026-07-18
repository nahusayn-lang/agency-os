"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FineStatusTabs, type FineTabItem } from "@/components/dashboard/fine-status-tabs";

export interface TeamFineUser {
  userId: string;
  userName: string;
  fines: FineTabItem[];
}

export function TeamFines({
  users,
  isSuperAdmin,
}: {
  users: TeamFineUser[];
  isSuperAdmin: boolean;
}) {
  const [openUserId, setOpenUserId] = useState<string | null>(null);

  if (users.length === 0) {
    return <p className="text-sm text-muted-foreground">No fines across the team.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {users.map((u) => {
        const totalDue = u.fines
          .filter((f) => f.status === "pending" || f.status === "submitted")
          .reduce((sum, f) => sum + Number(f.amount), 0);
        const isOpen = openUserId === u.userId;

        return (
          <Card
            key={u.userId}
            className={isOpen ? "sm:col-span-2 xl:col-span-3" : ""}
          >
            <CardHeader
              className="pb-2 cursor-pointer"
              onClick={() => setOpenUserId(isOpen ? null : u.userId)}
            >
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>{u.userName}</span>
                <span className="text-sm font-semibold">₹{totalDue}</span>
              </CardTitle>
            </CardHeader>
            {isOpen && (
              <CardContent>
                <FineStatusTabs fines={u.fines} adminActions={isSuperAdmin} />
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}