import { createLeadFormAction, getAssignableUsers } from "@/lib/crm/actions";
import { requireUserProfile } from "@/lib/auth/session";
import { LEAD_STAGES, LEAD_STAGE_LABELS } from "@/lib/types/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export async function CreateLeadForm() {
  const profile = await requireUserProfile();
  const users = await getAssignableUsers();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add lead</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={createLeadFormAction} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="business_name">Business name</Label>
            <Input id="business_name" name="business_name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stage">Stage</Label>
            <select
              id="stage"
              name="stage"
              required
              defaultValue="new_lead"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {LEAD_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {LEAD_STAGE_LABELS[stage]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="assigned_to">Assign to</Label>
            <select
              id="assigned_to"
              name="assigned_to"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select user</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                  {user.id === profile.id ? " — You" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Contact name (optional)</Label>
            <Input id="name" name="name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email (optional)</Label>
            <Input id="email" name="email" type="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deal_value">Deal value (optional)</Label>
            <Input id="deal_value" name="deal_value" type="number" step="0.01" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="next_followup">Next follow-up (optional)</Label>
            <Input id="next_followup" name="next_followup" type="datetime-local" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" name="notes" rows={3} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit">Create lead</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
