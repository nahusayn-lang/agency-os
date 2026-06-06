"use client";

import { useFormStatus } from "react-dom";
import { createReportFormAction } from "@/lib/reports/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Submitting..." : "Submit Report"}
    </Button>
  );
}

export function CreateReportForm() {
  return (
    <Card className="p-6">
      <form action={createReportFormAction} className="space-y-6">
        <div>
          <Label htmlFor="what_i_did_today">What I did today</Label>
          <Textarea id="what_i_did_today" name="what_i_did_today" placeholder="Summarize your work from today..." required rows={4} className="mt-2" />
        </div>

        <div>
          <Label htmlFor="completed_work">Completed work</Label>
          <Textarea id="completed_work" name="completed_work" placeholder="What tasks did you complete?" required rows={3} className="mt-2" />
        </div>

        <div>
          <Label htmlFor="pending_work">Pending work</Label>
          <Textarea id="pending_work" name="pending_work" placeholder="What tasks are still in progress?" required rows={3} className="mt-2" />
        </div>

        <div>
          <Label htmlFor="blockers">Blockers</Label>
          <Textarea id="blockers" name="blockers" placeholder="Any blockers or challenges you're facing?" required rows={3} className="mt-2" />
        </div>

        <SubmitButton />
      </form>
    </Card>
  );
}
