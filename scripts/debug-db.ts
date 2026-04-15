import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const STAKES_TABLE = process.env.DAHBOX_STAKES_TABLE || "DAHBOX_STAKES";
const clientConfig = { region: process.env.AWS_REGION || "us-east-1" };
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig));

async function run() {
    console.log("Checking DB...");
    try {
        const stakesResult = await ddb.send(new ScanCommand({ TableName: STAKES_TABLE }));
        console.log(`Found ${stakesResult.Items?.length} items total in table.`);
        
        const stakes = stakesResult.Items?.filter(i => i.pk.startsWith('MARKET#')) || [];
        console.log("--- STAKES ---");
        stakes.forEach(s => {
            console.log(`Market: ${s.pk}, User: ${s.userId}, Status: ${s.status}, Amount: ${s.amount}, Payout: ${s.actualPayout}`);
        });

        const leaders = stakesResult.Items?.filter(i => i.pk.startsWith('LEADERBOARD#')) || [];
        console.log("\n--- LEADERBOARD ENTRIES ---");
        leaders.forEach(l => {
            console.log(l);
        });

    } catch (e) {
        console.error("DB Error:", e);
    }
}
run();
