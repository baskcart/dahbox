import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  createStake,
  activateStake,
  deleteStake,
  getStakesForMarket,
  getStakesForUser,
  StakeRecord,
} from "../../lib/stakes";

// CORS: allow Memi (dah.mx) cross-origin for all stake operations.
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
    "Access-Control-Allow-Methods": "POST, PATCH, DELETE, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

/**
 * Hash a userId (potentially a long ML-DSA public key) to a short hex string
 * safe for use in DynamoDB sort keys (limit: 1024 bytes).
 * Full userId is preserved in the item body for auditing/querying.
 */
function hashUserId(userId: string): string {
  return createHash("sha256").update(userId).digest("hex").slice(0, 32);
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

/**
 * POST /api/stake — Phase 1: Reserve a pending stake.
 *
 * Called by Memi BEFORE the Rolledge transfer. Creates a stake record with
 * status="pending". No transactionId yet — money has NOT moved.
 *
 * Returns { stakeKey: { pk, sk } } so Memi can reference the record for Phase 2.
 *
 * Rollback: DELETE /api/stake  (if transfer fails — trivial, no ledger reversal needed)
 * Confirm:  PATCH  /api/stake  (if transfer succeeds — sets status=active + transactionId)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId, marketId, outcomeId, outcomeLabel,
      movieTitle, amount, totalPool, outcomeStaked,
    } = body;

    if (!userId || !marketId || !outcomeId || !amount) {
      return NextResponse.json(
        { success: false, error: "userId, marketId, outcomeId, and amount are required" },
        { status: 400, headers: corsHeaders(req) }
      );
    }
    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Amount must be a positive number" },
        { status: 400, headers: corsHeaders(req) }
      );
    }

    // S3 — Market close enforcement: reject stakes on expired markets.
    // closesAt is optional (legacy clients may omit it) but enforced when present.
    if (body.closesAt) {
      const closesAt = new Date(body.closesAt).getTime();
      if (!isNaN(closesAt) && Date.now() > closesAt) {
        return NextResponse.json(
          { success: false, error: "This market is closed. No more stakes accepted." },
          { status: 409, headers: corsHeaders(req) }
        );
      }
    }

    const userShareOfOutcome = amount / ((outcomeStaked || 0) + amount);
    const potentialPayout = Math.round(userShareOfOutcome * ((totalPool || 0) + amount) * 0.97 * 100) / 100;

    const timestamp = Date.now();
    const pk = `MARKET#${marketId}`;
    // Hash the full ML-DSA public key for both the sk AND the userId item attribute.
    // DynamoDB limits: sort key ≤ 1024 bytes, GSI indexed attribute ≤ 2048 bytes.
    // The raw key (2600+ bytes) blows both limits. The hash is a safe 32-char hex string.
    // userIdFull preserves the original for auditing (it is NOT indexed).
    const userIdHash = hashUserId(userId);
    const sk = `STAKE#${userIdHash}#${timestamp}`;

    const stake: StakeRecord = {
      pk,
      sk,
      userId: userIdHash,       // 32-char hex — safe for GSI index
      userIdFull: userId,       // full ML-DSA key, NOT indexed, for auditing only
      marketId,
      outcomeId,
      outcomeLabel: outcomeLabel || outcomeId,
      movieTitle: movieTitle || "Unknown",
      amount,
      totalPool: totalPool || 0,
      outcomeStaked: outcomeStaked || 0,
      status: "pending",  // Money has NOT moved yet
      potentialPayout,
      createdAt: new Date().toISOString(),
      // transactionId absent until PATCH /api/stake confirms the transfer
    };

    await createStake(stake);

    console.log(`[Stake] ⏳ RESERVED ${amount} DAH for ${userIdHash} (${userId.slice(0, 12)}...) on "${outcomeLabel}" | ${pk}`);

    return NextResponse.json({
      success: true,
      stakeKey: { pk, sk },   // Memi uses this to confirm or rollback
      potentialPayout,
    }, { headers: corsHeaders(req) });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Reserve failed";
    console.error("[Stake] POST error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500, headers: corsHeaders(req) });
  }
}

/**
 * PATCH /api/stake — Phase 2 (success): Confirm the stake.
 *
 * Called by Memi AFTER the Rolledge transfer succeeds.
 * Activates the pending stake and records the real transactionId.
 *
 * Body: { pk, sk, transactionId }
 */
export async function PATCH(req: NextRequest) {
  try {
    const { pk, sk, transactionId } = await req.json();

    if (!pk || !sk || !transactionId) {
      return NextResponse.json(
        { success: false, error: "pk, sk, and transactionId are required" },
        { status: 400, headers: corsHeaders(req) }
      );
    }

    await activateStake(pk, sk, transactionId);

    console.log(`[Stake] ✅ CONFIRMED ${pk}/${sk} | txn: ${transactionId}`);
    return NextResponse.json({ success: true, transactionId }, { headers: corsHeaders(req) });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Confirm failed";
    console.error("[Stake] PATCH error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500, headers: corsHeaders(req) });
  }
}

/**
 * DELETE /api/stake — Phase 2 (failure): Rollback the pending stake.
 *
 * Called by Memi when the Rolledge transfer fails after a successful reserve.
 * Deletes the pending record. No money has moved — this is a clean, trivial rollback.
 *
 * Body: { pk, sk }
 */
export async function DELETE(req: NextRequest) {
  try {
    const { pk, sk } = await req.json();

    if (!pk || !sk) {
      return NextResponse.json(
        { success: false, error: "pk and sk are required" },
        { status: 400, headers: corsHeaders(req) }
      );
    }

    await deleteStake(pk, sk);

    console.log(`[Stake] 🗑️ ROLLED BACK pending stake ${pk}/${sk}`);
    return NextResponse.json({ success: true }, { headers: corsHeaders(req) });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Rollback failed";
    console.error("[Stake] DELETE error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500, headers: corsHeaders(req) });
  }
}

/**
 * GET /api/stake?userId=X  — Get user's stakes
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
        success: true, userId, stakes, count: stakes.length,
        // Exclude pending from total — pending stakes haven't transferred yet
        totalStaked: stakes.filter(s => s.status !== "pending").reduce((s, st) => s + st.amount, 0),
      });
    }
    if (marketId) {
      const stakes = await getStakesForMarket(marketId);
      return NextResponse.json({
        success: true, marketId, stakes, count: stakes.length,
        totalPool: stakes.filter(s => s.status !== "pending").reduce((s, st) => s + st.amount, 0),
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
