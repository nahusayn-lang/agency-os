import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseOverridePayload } from "@/lib/performance/overrides";
import { PERFORMANCE_OVERRIDE_ACTION } from "@/lib/types/performance";
import { formatDate } from "@/lib/utils";
interface OverrideRow {
  id: string;
  action: string;
  target_entity: string;
  reason: string;
  created_at: string;
  super_admin_id: string;
}

interface OverrideHistoryTableProps {
  overrides: OverrideRow[];
  actorNames: Map<string, string>;
}

export function OverrideHistoryTable({
  overrides,
  actorNames,
}: OverrideHistoryTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>God mode override history</CardTitle>
        <CardDescription>All god mode overrides (immutable audit)</CardDescription>
      </CardHeader>
      <CardContent>
        {overrides.length === 0 ? (
          <p className="text-sm text-muted-foreground">No overrides recorded.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overrides.map((row) => {
                const payload =
                  row.action === PERFORMANCE_OVERRIDE_ACTION
                    ? parseOverridePayload(row.reason)
                    : null;
                const details = payload
                  ? `Override total ${payload.total_score.toFixed(2)} — ${payload.note ?? ""}`
                  : row.reason;

                return (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatDate(row.created_at)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {actorNames.get(row.super_admin_id) ?? "Unknown"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.action}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate font-mono text-xs">
                      {row.target_entity}
                    </TableCell>
                    <TableCell className="max-w-md text-sm">{details}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
