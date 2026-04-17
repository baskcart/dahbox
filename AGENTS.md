<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:dahbox-agent-rules -->
# DahBox Development Rules

## Non-negotiable constraints — apply to every change

1. **No interim / shortcut / fake / mock / quick fix.**
   If the correct implementation is not ready, the feature must be disabled and fail loudly. Never fake success.

2. **No mock data in production code paths.**
   Mock and stub are for tests only. Never ship placeholder values, fake wallet keys, or disabled checks in API routes.

3. **Create integration test cases as necessary.**
   Every change to stake flow, settlement logic, or Rolledge integration must have a corresponding test.

4. **Do not push changes.** Let the user run `git push`. Only stage and commit when explicitly asked to commit.

5. **Staking is owned by Memi.**
   DahBox does NOT call Rolledge directly for transfers. DahBox sends `STAKE_PLACED` postMessage to Memi, waits for `STAKE_CONFIRMED` + `transactionId`, then records in DAHBOX_STAKES. No exceptions.
<!-- END:dahbox-agent-rules -->
