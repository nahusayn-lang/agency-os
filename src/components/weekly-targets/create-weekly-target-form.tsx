"use client";

import { useFormStatus } from "react-dom";
import { createWeeklyTargetFormAction } from "@/lib/weekly-targets/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CreateWeeklyTargetFormProps { teamMembers: Array<{ id: string; name: string }> }

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? "Creating..." : "Create Weekly Target"}</Button>;
}

export function CreateWeeklyTargetForm({ teamMembers }: CreateWeeklyTargetFormProps) {
  return (
    <Card className="p-6">
      <form action={createWeeklyTargetFormAction} className="space-y-6">
        <div>
          <Label htmlFor="user_id">Team Member</Label>
          <Select name="user_id" required>
            <SelectTrigger className="mt-2"><SelectValue placeholder="Select a team member" /></SelectTrigger>
            <SelectContent>
              {teamMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="target_name">Target Name</Label>
          <Input id="target_name" name="target_name" placeholder="e.g., Complete project X" required className="mt-2" />
        </div>

        <SubmitButton />
      </form>
    </Card>
  );
}
