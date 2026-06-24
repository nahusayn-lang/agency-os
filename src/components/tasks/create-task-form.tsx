import { createTaskFormAction, getAssignableMembers } from "@/lib/tasks/actions";
import { requireUserProfile } from "@/lib/auth/session";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  const base = `${user.name} (${user.email})`;
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
            <select
              id="priority"
              name="priority"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              defaultValue="medium"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="deadline">Deadline</Label>
            <Input id="deadline" name="deadline" type="datetime-local" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="assigned_to">Assign to</Label>
            <select
              id="assigned_to"
              name="assigned_to"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select user</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {formatAssigneeLabel(member, profile.id, member.id)}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <SubmitButton loadingText="Creating task...">Create task</SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
