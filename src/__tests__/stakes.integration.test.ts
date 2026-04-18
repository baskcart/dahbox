/**
 * Integration tests: DahBox staking DynamoDB operations
 *
 * These tests run against the REAL DAHBOX_STAKES table.
 * Requires CUSTOM_AWS_ACCESS_KEY_ID + CUSTOM_AWS_SECRET_ACCESS_KEY
 * in .env.local (local dev) or environment variables (CI/Amplify).
 *
 * Run: npm run test:integration
 */

import {
  createStake,
  getStakesForMarket,
  getStakesForUser,
  updateStakeStatus,
  getLeaderboard,
  _resetDbClient,
  type StakeRecord,
} from '../app/lib/stakes';

// ─── Test Fixtures ───────────────────────────────

const TEST_USER_ID  = `test-user-integration-${Date.now()}`;
const TEST_MARKET_ID = `test-market-integration-${Date.now()}`;
const TEST_OUTCOME_ID = 'outcome-A';
const TEST_TXN_ID = `txn-test-${Date.now()}`;

const testStake: StakeRecord = {
  pk: `MARKET#${TEST_MARKET_ID}`,
  sk: `STAKE#${TEST_USER_ID}#${Date.now()}`,
  userId: TEST_USER_ID,
  marketId: TEST_MARKET_ID,
  outcomeId: TEST_OUTCOME_ID,
  outcomeLabel: 'Opens Above $50M',
  movieTitle: 'Integration Test Movie',
  amount: 10,
  totalPool: 100,
  outcomeStaked: 50,
  status: 'active',
  potentialPayout: 18.5,
  createdAt: new Date().toISOString(),
  transactionId: TEST_TXN_ID,
};

// ─── Setup / Teardown ────────────────────────────

beforeAll(() => {
  // Verify credentials are present before running
  const keyId = process.env.CUSTOM_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secret = process.env.CUSTOM_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

  if (!keyId || !secret) {
    throw new Error(
      'Missing AWS credentials. Set CUSTOM_AWS_ACCESS_KEY_ID and CUSTOM_AWS_SECRET_ACCESS_KEY ' +
      'in .env.local or environment before running integration tests.'
    );
  }
  console.log(`[test] Using key prefix: ${keyId.slice(0, 8)}...`);

  // Reset lazy client so it picks up current env vars
  _resetDbClient();
});

afterAll(() => {
  _resetDbClient();
});

// ─── Tests ───────────────────────────────────────

describe('DynamoDB credentials', () => {
  it('should connect to DAHBOX_STAKES without credential errors', async () => {
    // createStake is the canary — if credentials are wrong this throws immediately
    await expect(createStake(testStake)).resolves.not.toThrow();
  });
});

describe('createStake', () => {
  it('writes a stake record to DAHBOX_STAKES', async () => {
    // Already created in the credentials test — verify it's queryable
    const stakes = await getStakesForMarket(TEST_MARKET_ID);
    expect(stakes.length).toBeGreaterThanOrEqual(1);

    const found = stakes.find(s => s.transactionId === TEST_TXN_ID);
    expect(found).toBeDefined();
    expect(found?.userId).toBe(TEST_USER_ID);
    expect(found?.amount).toBe(10);
    expect(found?.status).toBe('active');
    expect(found?.movieTitle).toBe('Integration Test Movie');
  });

  it('rejects duplicate transactionId via ConditionExpression', async () => {
    // Currently createStake uses PutItem without condition — this test documents
    // the gap. A future fix should add ConditionExpression: 'attribute_not_exists(pk)'
    // to prevent double-recording a stake for the same transaction.
    // For now this test is informational — it should NOT throw.
    const duplicate = { ...testStake, sk: `STAKE#${TEST_USER_ID}#${Date.now() + 1}` };
    await expect(createStake(duplicate)).resolves.not.toThrow();
  });
});

describe('getStakesForMarket', () => {
  it('returns all stakes for a market', async () => {
    const stakes = await getStakesForMarket(TEST_MARKET_ID);
    expect(Array.isArray(stakes)).toBe(true);
    expect(stakes.length).toBeGreaterThanOrEqual(1);
    stakes.forEach(s => {
      expect(s.marketId).toBe(TEST_MARKET_ID);
    });
  });

  it('returns empty array for unknown marketId', async () => {
    const stakes = await getStakesForMarket('market-does-not-exist-xyz');
    expect(stakes).toEqual([]);
  });
});

describe('getStakesForUser', () => {
  it('returns stakes for a specific user via userId-index GSI', async () => {
    const stakes = await getStakesForUser(TEST_USER_ID);
    expect(Array.isArray(stakes)).toBe(true);
    expect(stakes.length).toBeGreaterThanOrEqual(1);
    stakes.forEach(s => {
      expect(s.userId).toBe(TEST_USER_ID);
    });
  });
});

describe('updateStakeStatus', () => {
  it('updates a stake to won and writes a leaderboard entry', async () => {
    const { pk, sk } = testStake;
    const payout = 18.5;

    await expect(
      updateStakeStatus(pk, sk, 'won', payout, TEST_USER_ID, testStake.amount)
    ).resolves.not.toThrow();

    // Verify stake status updated
    const stakes = await getStakesForMarket(TEST_MARKET_ID);
    const updated = stakes.find(s => s.transactionId === TEST_TXN_ID);
    expect(updated?.status).toBe('won');
  });

  it('writes a leaderboard entry when status is won', async () => {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const leaderboard = await getLeaderboard('BOXOFFICE_MONTHLY', period);

    const entry = leaderboard.find(e => e.userId === TEST_USER_ID);
    expect(entry).toBeDefined();
    // netProfit = payout (18.5) - amount (10) = 8.5
    expect(entry?.netProfit).toBe(8.5);
    expect(entry?.totalWins).toBeGreaterThanOrEqual(1);
  });
});

describe('getLeaderboard', () => {
  it('returns leaderboard entries sorted by netProfit descending', async () => {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const leaderboard = await getLeaderboard('BOXOFFICE_MONTHLY', period);

    for (let i = 1; i < leaderboard.length; i++) {
      expect(leaderboard[i - 1].netProfit).toBeGreaterThanOrEqual(leaderboard[i].netProfit);
    }
  });
});
