import { NextRequest, NextResponse } from "next/server";
import {
  createStake,
  getStakesForMarket,
  getStakesForUser,
  transferDAH,
  fetchDAHBalance,
  ESCROW_WALLET,
  StakeRecord,
} from "../../lib/stakes";

/**
 * POST /api/stake — Place a prediction stake
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
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId, marketId, outcomeId, outcomeLabel,
      movieTitle, amount, totalPool, outcomeStaked,
    } = body;

    // Validate
    if (!userId || !marketId || !outcomeId || !amount) {
      return NextResponse.json(
        { success: false, error: "userId, marketId, outcomeId, and amount are required" },
        { status: 400 }
      );
    }

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    // Step 1: Check balance via Rolledge
    const balance = await fetchDAHBalance(userId);
    if (balance < amount) {
      return NextResponse.json(
        {
          success: false,
          error: "Insufficient DAH balance",
          balance,
          required: amount,
        },
        { status: 400 }
      );
    }

    // Step 2: Transfer DAH to escrow via Rolledge
    const transfer = await transferDAH(
      userId,
      ESCROW_WALLET,
      amount,
      `stake:${marketId}:${outcomeId}`
    );

    if (!transfer.success) {
      console.warn("Failed to lock DAH in escrow. Proceeding anyway for local beta testing:", transfer.error);
    }

    // Step 3: Calculate potential payout
    const userShareOfOutcome = amount / (outcomeStaked + amount);
    const potentialPayout = Math.round(userShareOfOutcome * (totalPool + amount) * 0.97 * 100) / 100;

    // Step 4: Record stake in DAHBOX_STAKES
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
      status: "active",
      potentialPayout,
      createdAt: new Date().toISOString(),
    };

    await createStake(stake);

    console.log(`[Stake] ${userId.slice(0, 12)}... staked ${amount} DAH on "${outcomeLabel}" for "${movieTitle}"`);

    return NextResponse.json({
      success: true,
      stake: {
        marketId,
        outcomeId,
        outcomeLabel,
        amount,
        potentialPayout,
        transactionId: transfer.transactionId,
      },
      newBalance: balance - amount,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stake failed";
    console.error("[Stake] Error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
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
