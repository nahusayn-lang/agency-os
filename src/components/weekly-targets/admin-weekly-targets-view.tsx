"use client";

import { useState } from "react";
import { updateWeeklyTargetNotesAction } from "@/lib/weekly-targets/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";
import type { WeeklyTargetWithUsers } from "@/lib/types/weekly-targets";

interface AdminWeeklyTargetsViewProps { targets: WeeklyTargetWithUsers[] }

export function AdminWeeklyTargetsView({ targets }: AdminWeeklyTargetsViewProps) {
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  const handleNotesChange = (targetId: string, value: string) => setNotesMap(prev => ({ ...prev, [targetId]: value }));

  const handleUpdateNotes = async (targetId: string) => {
    const notes = notesMap[targetId];
    if (notes === undefined) return;
    setLoadingMap(prev => ({ ...prev, [targetId]: true }));
    try {
      const result = await updateWeeklyTargetNotesAction(targetId, notes);
      if (result.error) alert(result.error);
    } catch {
      alert("Failed to update notes");
    } finally {
      setLoadingMap(prev => ({ ...prev, [targetId]: false }));
    }
  };

  if (!targets || targets.length === 0) return (
    <Card className="p-6"><p className="text-center text-muted-foreground">No weekly targets found.</p></Card>
  );

  return (
    <div className="space-y-4">
      {targets.map(target => (
        <Card key={target.id} className="p-6">
          <div className="mb-4 space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold">{target.target_name}</h3>
                {target.user && <p className="text-sm text-muted-foreground">{target.user.name} ({target.user.email})</p>}
                <p className="text-xs text-muted-foreground">{formatDate(target.created_at)}</p>
              </div>
              <Badge variant="outline">{target.completion_percentage}%</Badge>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor={`notes_${target.id}`}>Admin Notes</Label>
              <Textarea id={`notes_${target.id}`} placeholder="Add notes about this target..." value={notesMap[target.id] ?? target.admin_notes ?? ""} onChange={e => handleNotesChange(target.id, e.target.value)} className="mt-2" rows={3} />
            </div>

            <Button onClick={() => handleUpdateNotes(target.id)} disabled={loadingMap[target.id]} variant="outline" size="sm">{loadingMap[target.id] ? "Saving..." : "Save Notes"}</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
