import { createLeadFormAction, getAssignableUsers } from "@/lib/crm/actions";
import { requireUserProfile } from "@/lib/auth/session";
import { LEAD_STAGES, LEAD_STAGE_LABELS } from "@/lib/types/crm";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
            <Select name="stage" defaultValue="new_lead" required>
              <SelectTrigger id="stage" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STAGES.map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {LEAD_STAGE_LABELS[stage]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="assigned_to">Assign to</Label>
            <Select name="assigned_to" required>
              <SelectTrigger id="assigned_to" className="w-full">
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                    {user.id === profile.id ? " — You" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <SubmitButton loadingText="Creating lead...">Create lead</SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}