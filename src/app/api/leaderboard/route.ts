import { NextRequest, NextResponse } from "next/server";
import { getLeaderboard } from "@/app/lib/stakes";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const period = searchParams.get('period');

    if (!type || !period) {
        return NextResponse.json({ error: "Missing type or period parameter", success: false }, { status: 400 });
    }

    const limit = searchParams.has('limit') ? parseInt(searchParams.get('limit') as string) : 50;

    const leaders = await getLeaderboard(type, period, limit);

    return NextResponse.json({
      success: true,
      leaders
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("[Leaderboard API] error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
