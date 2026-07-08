"use client";

import { useState } from "react";
import { updateWeeklyTargetCompletionAction } from "@/lib/weekly-targets/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WeeklyTargetWithUsers } from "@/lib/types/weekly-targets";

interface WeeklyTargetsListProps { targets: WeeklyTargetWithUsers[]; isMemberView?: boolean }

export function WeeklyTargetsList({ targets, isMemberView = false }: WeeklyTargetsListProps) {
  const [completionMap, setCompletionMap] = useState<Record<string, number>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  const handleCompletionChange = (targetId: string, value: number) => setCompletionMap(prev => ({ ...prev, [targetId]: value }));

  const handleUpdateCompletion = async (targetId: string) => {
    const value = completionMap[targetId];
    if (value === undefined) return;
    setLoadingMap(prev => ({ ...prev, [targetId]: true }));
    try {
      const result = await updateWeeklyTargetCompletionAction(targetId, value);
      if (result.error) alert(result.error);
    } catch {
      alert("Failed to update completion");
    } finally {
      setLoadingMap(prev => ({ ...prev, [targetId]: false }));
    }
  };

  if (!targets || targets.length === 0) return (
    <Card className="p-6"><p className="text-center text-muted-foreground">No weekly targets yet.</p></Card>
  );

  return (
    <div className="space-y-4">
      {targets.map(target => (
        <Card key={target.id} className="p-6">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold">{target.target_name}</h3>
              {!isMemberView && target.user && <p className="text-sm text-muted-foreground">{target.user.name}</p>}
              <p className="text-xs text-muted-foreground">{new Date(target.created_at).toLocaleDateString()}</p>
            </div>
            <Badge variant="outline">{target.completion_percentage}%</Badge>
          </div>

          {isMemberView && (
            <div className="space-y-3">
              <div>
                <Label htmlFor={`completion_${target.id}`}>Update Completion %</Label>
                <div className="mt-2 flex gap-2">
                  <Input id={`completion_${target.id}`} type="number" min={0} max={100} value={completionMap[target.id] ?? target.completion_percentage} onChange={e => handleCompletionChange(target.id, parseInt(e.target.value))} className="flex-1" />
                  <Button onClick={() => handleUpdateCompletion(target.id)} disabled={loadingMap[target.id]} variant="outline">{loadingMap[target.id] ? "Saving..." : "Save"}</Button>
                </div>
              </div>
            </div>
          )}

          {target.admin_notes && <div className="mt-4 rounded bg-muted p-3"><p className="text-xs font-semibold text-muted-foreground">Admin Notes</p><p className="text-sm">{target.admin_notes}</p></div>}
        </Card>
      ))}
    </div>
  );
}
