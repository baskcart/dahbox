import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const STAKES_TABLE = process.env.DAHBOX_STAKES_TABLE || "DAHBOX_STAKES";
const ROLLEDGE_API = process.env.ROLLEDGE_API_URL || "https://rolledge.dah.gg";
const ESCROW_WALLET = process.env.DAHBOX_ESCROW_WALLET || "DAHBOX_ESCROW";

// ─── DynamoDB Client ─────────────────────────────

const clientConfig: Record<string, unknown> = {
  region: process.env.AWS_REGION || "us-east-1",
};

const accessKeyId =
  process.env.CUSTOM_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey =
  process.env.CUSTOM_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

if (accessKeyId && secretAccessKey) {
  clientConfig.credentials = { accessKeyId, secretAccessKey };
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig));

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
  status: "active" | "won" | "lost" | "paid";
  potentialPayout: number;
  actualPayout?: number;
  createdAt: string;
  resolvedAt?: string;
}

// ─── Stake Operations ────────────────────────────

export async function createStake(stake: StakeRecord): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: STAKES_TABLE,
      Item: stake,
    })
  );
}

export async function getStakesForMarket(
  marketId: string
): Promise<StakeRecord[]> {
  const result = await ddb.send(
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
  const result = await ddb.send(
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
  actualPayout?: number
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

  await ddb.send(
    new UpdateCommand({
      TableName: STAKES_TABLE,
      Key: { pk, sk },
      UpdateExpression: updateExpr,
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: exprValues,
    })
  );
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
