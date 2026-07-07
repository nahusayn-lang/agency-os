import { NextResponse } from "next/server";
import { sweepMissedCheckouts, sweepOverdueFines } from "@/lib/services/strike-fine-engine";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const missedCheckouts = await sweepMissedCheckouts();
    const overdueFineStrikes = await sweepOverdueFines();

    return NextResponse.json({
      success: true,
      missedCheckouts,
      overdueFineStrikes,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}