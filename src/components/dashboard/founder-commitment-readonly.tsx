import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface FounderCommitmentReadonlyProps {
  weekStart: string;
  commitmentText: string | null;
}

export function FounderCommitmentReadonly({
  weekStart,
  commitmentText,
}: FounderCommitmentReadonlyProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Founder commitment</CardTitle>
        <CardDescription>Week starting {weekStart}</CardDescription>
      </CardHeader>
      <CardContent>
        {commitmentText ? (
          <p className="whitespace-pre-wrap text-sm">{commitmentText}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No founder commitment has been set for this week yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
