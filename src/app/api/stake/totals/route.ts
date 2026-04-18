import { NextRequest, NextResponse } from "next/server";
import { getStakesForMarket } from "../../../lib/stakes";

/**
 * GET /api/stake/totals?marketIds=market-ow-123,market-ou-123,...
 *
 * Bulk fetch real staked amounts for multiple markets in parallel.
 * Returns per-market pool totals and per-outcome breakdowns.
 * Used by the UI to replace Math.random() pool estimates with real ledger data.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("marketIds") || "";
    const marketIds = raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (marketIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "marketIds query param required (comma-separated)" },
        { status: 400 }
      );
    }

    if (marketIds.length > 50) {
      return NextResponse.json(
        { success: false, error: "Max 50 market IDs per request" },
        { status: 400 }
      );
    }

    // Fetch all markets in parallel
    const results = await Promise.allSettled(
      marketIds.map(async (marketId) => {
        const stakes = await getStakesForMarket(marketId);
        const totalPool = stakes.reduce((sum, s) => sum + s.amount, 0);

        // Per-outcome totals
        const outcomeTotals: Record<string, number> = {};
        for (const stake of stakes) {
          outcomeTotals[stake.outcomeId] =
            (outcomeTotals[stake.outcomeId] || 0) + stake.amount;
        }

        return { marketId, totalPool, outcomeTotals, stakeCount: stakes.length };
      })
    );

    const totals: Record<
      string,
      { totalPool: number; outcomeTotals: Record<string, number>; stakeCount: number }
    > = {};

    for (let i = 0; i < marketIds.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        const { marketId, totalPool, outcomeTotals, stakeCount } = result.value;
        totals[marketId] = { totalPool, outcomeTotals, stakeCount };
      } else {
        // Market query failed — return 0 so UI degrades gracefully
        totals[marketIds[i]] = { totalPool: 0, outcomeTotals: {}, stakeCount: 0 };
        console.error(`[stake/totals] Failed for ${marketIds[i]}:`, result.reason);
      }
    }

    return NextResponse.json({ success: true, totals });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch totals";
    console.error("[stake/totals] Error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
