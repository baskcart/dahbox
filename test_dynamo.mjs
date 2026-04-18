import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const accessKeyId = process.env.CUSTOM_AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.CUSTOM_AWS_SECRET_ACCESS_KEY;

console.log(`Key set: ${!!accessKeyId} | Prefix: ${(accessKeyId||'').slice(0,8)}...`);
console.log(`Secret set: ${!!secretAccessKey}`);

const cfg = { region: 'us-east-1' };
if (accessKeyId && secretAccessKey) {
  cfg.credentials = { accessKeyId, secretAccessKey };
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient(cfg));
const testPk = 'TEST#connectivity';
const testSk = `PING#${Date.now()}`;

ddb.send(new PutCommand({
  TableName: 'DAHBOX_STAKES',
  Item: { pk: testPk, sk: testSk, test: true, ts: new Date().toISOString() }
}))
.then(() => {
  console.log('OK: PutItem succeeded — credentials and permissions are correct');
  // Clean up
  return ddb.send(new DeleteCommand({ TableName: 'DAHBOX_STAKES', Key: { pk: testPk, sk: testSk } }));
})
.then(() => console.log('OK: Test item cleaned up'))
.catch(e => console.error('FAIL:', e.name, '-', e.message));
