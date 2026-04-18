import { createHash } from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const STAKES_TABLE = process.env.DAHBOX_STAKES_TABLE || "DAHBOX_STAKES";
const ROLLEDGE_API = process.env.ROLLEDGE_API_URL || "https://rolledge.dah.gg";
const ESCROW_WALLET = process.env.DAHBOX_ESCROW_WALLET || "DAHBOX_ESCROW";

// ─── DynamoDB Client (lazy) ───────────────────────
// Client is created on first use, NOT at module load time.
// This guarantees process.env is read from the actual Lambda runtime environment,
// not from whatever was available when the module was first bundled/loaded.

let _ddb: DynamoDBDocumentClient | null = null;

function getDb(): DynamoDBDocumentClient {
  if (_ddb) return _ddb;

  const accessKeyId =
    process.env.CUSTOM_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.CUSTOM_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

  // Diagnostic log — shows what credentials are available at Lambda runtime.
  // Remove once credential injection is confirmed working.
  console.log(
    `[DahBox/db] CUSTOM_KEY=${process.env.CUSTOM_AWS_ACCESS_KEY_ID?.slice(0,8) ?? "MISSING"} ` +
    `AWS_KEY=${process.env.AWS_ACCESS_KEY_ID?.slice(0,8) ?? "MISSING"} ` +
    `resolved=${accessKeyId?.slice(0,8) ?? "NONE"}`
  );

  const config: ConstructorParameters<typeof DynamoDBClient>[0] = {
    region: process.env.AWS_REGION || "us-east-1",
  };

  if (accessKeyId && secretAccessKey) {
    config.credentials = { accessKeyId, secretAccessKey };
  }

  _ddb = DynamoDBDocumentClient.from(new DynamoDBClient(config));
  return _ddb;
}

// ─── Test helper (resets lazy client — for integration tests) ───
export function _resetDbClient(): void {
  _ddb = null;
}

/**
 * Hash a userId (ML-DSA public key, potentially thousands of bytes) to a
 * 32-char hex string safe for DynamoDB sort keys (limit: 1024 bytes).
 * The full userId is always stored in the item body.
 */
function hashUserId(userId: string): string {
  return createHash("sha256").update(userId).digest("hex").slice(0, 32);
}

// ─── Types ───────────────────────────────────────

export interface StakeRecord {
  pk: string; // MARKET#{marketId}
  sk: string; // STAKE#{userId}#{timestamp}
  userId: string;
  marketId: string;
  outcomeId: string;
  outcomeLabel: string;
  movieTitle: string;
  amount: number;
  totalPool: number;
  outcomeStaked: number;
  status: "pending" | "active" | "won" | "lost" | "paid";
  potentialPayout: number;
  actualPayout?: number;
  createdAt: string;
  resolvedAt?: string;
  transactionId?: string; // Rolledge ROLLEDGE_LEDGER transaction_id — set on confirm
}

// ─── Stake Operations ────────────────────────────

/** Phase 1: Write a pending stake (no transactionId yet — money has NOT moved). */
export async function createStake(stake: StakeRecord): Promise<void> {
  await getDb().send(
    new PutCommand({
      TableName: STAKES_TABLE,
      Item: stake,
    })
  );
}

/**
 * Phase 2 (success): Transfer confirmed — activate the pending stake.
 * Sets status → "active" and records the Rolledge transactionId.
 */
export async function activateStake(pk: string, sk: string, transactionId: string): Promise<void> {
  await getDb().send(
    new UpdateCommand({
      TableName: STAKES_TABLE,
      Key: { pk, sk },
      UpdateExpression: "SET #s = :active, transactionId = :txnId, activatedAt = :now",
      ConditionExpression: "#s = :pending",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":active": "active",
        ":pending": "pending",
        ":txnId": transactionId,
        ":now": new Date().toISOString(),
      },
    })
  );
}

/**
 * Phase 2 (failure): Transfer failed — delete the pending stake record.
 * Called when the Rolledge transfer fails after a successful reserve.
 * No money has moved at this point, so this is a clean rollback.
 */
export async function deleteStake(pk: string, sk: string): Promise<void> {
  await getDb().send(
    new DeleteCommand({
      TableName: STAKES_TABLE,
      Key: { pk, sk },
    })
  );
}

export async function getStakesForMarket(
  marketId: string
): Promise<StakeRecord[]> {
  const result = await getDb().send(
    new QueryCommand({
      TableName: STAKES_TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": `MARKET#${marketId}` },
    })
  );
  return (result.Items as StakeRecord[]) || [];
}

export async function getStakesForUser(
  userId: string
): Promise<StakeRecord[]> {
  const result = await getDb().send(
    new QueryCommand({
      TableName: STAKES_TABLE,
      IndexName: "userId-index",
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: { ":uid": userId },
      ScanIndexForward: false,
    })
  );
  return (result.Items as StakeRecord[]) || [];
}

export async function updateStakeStatus(
  pk: string,
  sk: string,
  status: "won" | "lost" | "paid",
  actualPayout?: number,
  userId?: string,
  stakedAmount?: number
): Promise<void> {
  const updateExpr = actualPayout !== undefined
    ? "SET #s = :status, resolvedAt = :now, actualPayout = :payout"
    : "SET #s = :status, resolvedAt = :now";

  const exprValues: Record<string, unknown> = {
    ":status": status,
    ":now": new Date().toISOString(),
  };
  if (actualPayout !== undefined) {
    exprValues[":payout"] = actualPayout;
  }

  await getDb().send(
    new UpdateCommand({
      TableName: STAKES_TABLE,
      Key: { pk, sk },
      UpdateExpression: updateExpr,
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: exprValues,
    })
  );

  // Auto-update leaderboard if the stake is won, paid out, or lost
  if ((status === "paid" || status === "won" || status === "lost") && userId && actualPayout !== undefined && stakedAmount !== undefined) {
    const netProfit = actualPayout - stakedAmount;
    const isWin = status === "paid" || status === "won";
    
    // We categorize the leaderboard by year-month and type for future-proofing
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const leaderboardPk = `LEADERBOARD#BOXOFFICE_MONTHLY#${monthStr}`;
    const leaderboardSk = `USER#${hashUserId(userId)}`;

    await getDb().send(
      new UpdateCommand({
        TableName: STAKES_TABLE,
        Key: { pk: leaderboardPk, sk: leaderboardSk },
        UpdateExpression: "ADD netProfit :profit, totalWins :win SET userId = :userId, updatedAt = :now",
        ExpressionAttributeValues: {
          ":profit": netProfit,
          ":win": isWin ? 1 : 0,
          ":userId": userId,
          ":now": new Date().toISOString(),
        },
      })
    );
  }
}

// ─── Leaderboard Operations ──────────────────────

export interface LeaderboardRecord {
  pk: string;
  sk: string;
  userId: string;
  netProfit: number;
  totalWins: number;
  updatedAt: string;
}

export async function getLeaderboard(
  type: string,
  period: string, // e.g., "2026-06"
  limit: number = 50
): Promise<LeaderboardRecord[]> {
  const result = await getDb().send(
    new QueryCommand({
      TableName: STAKES_TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": `LEADERBOARD#${type}#${period}` },
    })
  );
  
  const records = (result.Items as LeaderboardRecord[]) || [];
  // Sort descending by netProfit
  return records.sort((a, b) => (b.netProfit || 0) - (a.netProfit || 0)).slice(0, limit);
}

// ─── Rolledge Ledger Integration ─────────────────

export async function transferDAH(
  source: string,
  destination: string,
  amount: number,
  memo: string
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    const res = await fetch(`${ROLLEDGE_API}/api/ledger/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source,
        destination,
        amount,
        currency: "DAH",
        signature: `dahbox_${Date.now()}`, // System-generated signature
        memo,
      }),
    });

    const data = await res.json();
    return {
      success: data.success || false,
      transactionId: data.transactionId,
      error: data.error,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transfer failed";
    console.error("[DahBox] Rolledge transfer error:", message);
    return { success: false, error: message };
  }
}

export async function fetchDAHBalance(publicKey: string): Promise<number> {
  try {
    const res = await fetch(
      `${ROLLEDGE_API}/api/ledger/balance?publicKey=${encodeURIComponent(publicKey)}`
    );
    const data = await res.json();
    return data.success ? data.balance : 0;
  } catch {
    return 0;
  }
}

export { ESCROW_WALLET, STAKES_TABLE };
