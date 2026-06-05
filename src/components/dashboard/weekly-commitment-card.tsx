"use client";

import { useState, useTransition } from "react";
import { saveFounderWeeklyCommitmentAction } from "@/lib/founder-commitment/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface WeeklyCommitmentCardProps {
  weekStart: string;
  initialText: string;
}

export function WeeklyCommitmentCard({
  weekStart,
  initialText,
}: WeeklyCommitmentCardProps) {
  const [text, setText] = useState(initialText);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveFounderWeeklyCommitmentAction(text, weekStart);
      if (result?.error) {
        setMessage(result.error);
      } else {
        setMessage("Commitment saved.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly commitment</CardTitle>
        <CardDescription>
          Week starting {weekStart}. Visible to the team (read-only).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="founder-commitment">Your commitment</Label>
          <Textarea
            id="founder-commitment"
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What will you deliver this week?"
          />
        </div>
        <Button type="button" disabled={pending} onClick={handleSave}>
          {pending ? "Saving…" : "Save commitment"}
        </Button>
        {message && (
          <p
            className={`text-sm ${message.includes("saved") ? "text-muted-foreground" : "text-destructive"}`}
          >
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
