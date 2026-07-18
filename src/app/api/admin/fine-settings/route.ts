import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import { getFineAmount, setFineAmount } from "@/lib/services/strike-fine-engine";

export async function GET() {
  await requireUserProfile();
  const amount = await getFineAmount();
  return NextResponse.json({ amount });
}

export async function POST(req: Request) {
  const profile = await requireUserProfile();

  if (profile.role !== "super_admin") {
    return NextResponse.json({ error: "Only the founder can change the fine amount." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const amount = Number(body.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Valid positive amount do." }, { status: 400 });
    }

    await setFineAmount(amount, profile.id);
    return NextResponse.json({ success: true, amount });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}