import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const STAKES_TABLE = process.env.DAHBOX_STAKES_TABLE || "DAHBOX_STAKES";
const W3SHIP_API_URL = process.env.W3SHIP_API_URL || "http://localhost:3000"; // Update in prod

const clientConfig = { region: process.env.AWS_REGION || "us-east-1" };
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig));

async function snapshotWinners(monthStr: string) {
    console.log(`Snapshotting winners for BOXOFFICE_MONTHLY, month: ${monthStr}`);

    const result = await ddb.send(
        new QueryCommand({
            TableName: STAKES_TABLE,
            KeyConditionExpression: "pk = :pk",
            ExpressionAttributeValues: { ":pk": `LEADERBOARD#BOXOFFICE_MONTHLY#${monthStr}` }
        })
    );

    const records = result.Items || [];
    records.sort((a, b) => (b.netProfit || 0) - (a.netProfit || 0));

    // Get Top 10
    const top10 = records.slice(0, 10);
    const winners = top10.map(r => r.userId);

    console.log(`Found ${winners.length} winners:`, winners);

    if (winners.length === 0) {
        console.log("No winners to sync.");
        return;
    }

    try {
        const res = await fetch(`${W3SHIP_API_URL}/api/entitlement/amc`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer DAHBOX_SYSTEM_SECRET`
            },
            body: JSON.stringify({
                winners,
                month: monthStr
            })
        });

        const data = await res.json();
        if (data.success) {
            console.log("Succesfully synced winners to W3Ship!");
        } else {
            console.error("Failed to sync to W3Ship:", data.error);
        }
    } catch (e) {
        console.error("Error communicating with W3Ship API:", e);
    }
}

// Allow passing month as argument
const monthArg = process.argv[2];
if (!monthArg) {
    const now = new Date();
    // Default to last month if run on the 1st
    if (now.getDate() === 1) {
        now.setMonth(now.getMonth() - 1);
    }
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    snapshotWinners(defaultMonth);
} else {
    snapshotWinners(monthArg);
}
