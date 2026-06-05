import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function TeamProfilesList({ members }: { members: TeamMember[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team performance profiles</CardTitle>
        <CardDescription>
          View calculated scores and record god mode overrides
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {members.map((member) => (
            <li key={member.id}>
              <Link
                href={`/dashboard/team/${member.id}`}
                className="text-sm font-medium hover:underline"
              >
                {member.name}
              </Link>
              <span className="ml-2 text-xs text-muted-foreground">
                {member.email} · {member.role}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
