import { NextRequest, NextResponse } from "next/server";
import {
  createStake,
  getStakesForMarket,
  getStakesForUser,
  StakeRecord,
} from "../../lib/stakes";

// CORS: allow Memi (dah.mx) to call /api/stake cross-origin.
// Security is provided by the transactionId requirement — only real
// Rolledge-confirmed transfers produce a valid transactionId.
const ALLOWED_ORIGINS = [
  "https://dah.mx",
  "https://www.dah.mx",
  process.env.NEXT_PUBLIC_MEMI_URL,
].filter(Boolean);

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] ?? "https://dah.mx");
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

/**
 * POST /api/stake — Record a confirmed prediction stake
 *
 * This route ONLY records the stake in DAHBOX_STAKES.
 * The Rolledge ledger transfer (debit from user, credit to market escrow)
 * is handled by Memi using the user's ML-DSA signing key before this is called.
 *
 * DahBox receives STAKE_CONFIRMED + transactionId from Memi via postMessage,
 * then calls this endpoint to record the result.
 *
 * Body: {
 *   userId: string (publicKey),
 *   marketId: string,
 *   outcomeId: string,
 *   outcomeLabel: string,
 *   movieTitle: string,
 *   amount: number,
 *   totalPool: number,
 *   outcomeStaked: number,
 *   transactionId: string  — from the real Rolledge transfer
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId, marketId, outcomeId, outcomeLabel,
      movieTitle, amount, totalPool, outcomeStaked, transactionId,
    } = body;

    // Validate required fields
    if (!userId || !marketId || !outcomeId || !amount) {
      return NextResponse.json(
        { success: false, error: "userId, marketId, outcomeId, and amount are required" },
        { status: 400 }
      );
    }

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: "transactionId is required — stake must be pre-confirmed by Memi" },
        { status: 400 }
      );
    }

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    // Calculate potential payout (for display — actual payout settled at resolution)
    const userShareOfOutcome = amount / ((outcomeStaked || 0) + amount);
    const potentialPayout = Math.round(userShareOfOutcome * ((totalPool || 0) + amount) * 0.97 * 100) / 100;

    // Record stake in DAHBOX_STAKES
    const timestamp = Date.now();
    const stake: StakeRecord = {
      pk: `MARKET#${marketId}`,
      sk: `STAKE#${userId}#${timestamp}`,
      userId,
      marketId,
      outcomeId,
      outcomeLabel: outcomeLabel || outcomeId,
      movieTitle: movieTitle || "Unknown",
      amount,
      totalPool: totalPool || 0,
      outcomeStaked: outcomeStaked || 0,
      status: "active",
      potentialPayout,
      createdAt: new Date().toISOString(),
      transactionId,  // links to Rolledge ROLLEDGE_LEDGER entry
    };

    await createStake(stake);

    console.log(`[Stake] ✅ ${userId.slice(0, 12)}... staked ${amount} DAH on "${outcomeLabel}" for "${movieTitle}" | txn: ${transactionId}`);

    return NextResponse.json({
      success: true,
      stake: {
        marketId,
        outcomeId,
        outcomeLabel,
        amount,
        potentialPayout,
        transactionId,
      },
    }, { headers: corsHeaders(req) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stake failed";
    console.error("[Stake] Error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500, headers: corsHeaders(req) });
  }
}

/**
 * GET /api/stake?userId=X — Get user's stakes
 * GET /api/stake?marketId=X — Get stakes for a market
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const marketId = searchParams.get("marketId");

    if (userId) {
      const stakes = await getStakesForUser(userId);
      return NextResponse.json({
        success: true,
        userId,
        stakes,
        count: stakes.length,
        totalStaked: stakes.reduce((s, st) => s + st.amount, 0),
      });
    }

    if (marketId) {
      const stakes = await getStakesForMarket(marketId);
      return NextResponse.json({
        success: true,
        marketId,
        stakes,
        count: stakes.length,
        totalPool: stakes.reduce((s, st) => s + st.amount, 0),
      });
    }

    return NextResponse.json(
      { success: false, error: "Provide userId or marketId" },
      { status: 400 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Query failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
