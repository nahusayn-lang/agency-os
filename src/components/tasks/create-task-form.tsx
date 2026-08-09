import { createTaskFormAction, getAssignableMembers } from "@/lib/tasks/actions";
import { requireUserProfile } from "@/lib/auth/session";
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

function formatAssigneeLabel(
  user: { name: string; email: string; is_active?: boolean },
  currentUserId: string,
  userId: string
): string {
  const base = user.name;
  if (userId === currentUserId) {
    return `${base} — You`;
  }
  if (user.is_active === false) {
    return `${base} — Inactive`;
  }
  return base;
}

export async function CreateTaskForm() {
  const profile = await requireUserProfile();
  const members = await getAssignableMembers();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create task</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={createTaskFormAction} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select name="priority" defaultValue="medium">
              <SelectTrigger id="priority" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="deadline">Deadline</Label>
            <Input id="deadline" name="deadline" type="datetime-local" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="assigned_to">Assign to</Label>
            <Select name="assigned_to" required>
              <SelectTrigger id="assigned_to" className="w-full">
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {formatAssigneeLabel(member, profile.id, member.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <SubmitButton loadingText="Creating task...">Create task</SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}