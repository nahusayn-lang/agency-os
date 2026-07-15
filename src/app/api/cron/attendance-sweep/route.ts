import { NextResponse } from "next/server";
import {
  sweepMissedCheckouts,
  sweepOverdueFines,
  sweepAbsentUsers,
  sweepStaleShiftSessions,
} from "@/lib/services/strike-fine-engine";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const staleShiftClosed = await sweepStaleShiftSessions();
    const missedCheckouts = await sweepMissedCheckouts();
    const overdueFineStrikes = await sweepOverdueFines();
    const absentStrikes = await sweepAbsentUsers();

    return NextResponse.json({
      success: true,
      staleShiftClosed,
      missedCheckouts,
      overdueFineStrikes,
      absentStrikes,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}