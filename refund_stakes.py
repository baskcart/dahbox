"""
DAHBOX STAKE REFUND — Admin recovery script
============================================
Context:
  - 6 stake transfers succeeded (DEBIT, chain: 100→90→80→70→60→50→40)
  - 6 corresponding DAHBOX_STAKES records FAILED to write (credential error)
  - Since stakes were never recorded, transfers must be refunded
  
Action:
  Write ONE CREDIT entry of 60 DAH to restore balance from 40 → 100.
  Following the chain model: prev_balance=40, amount=60, new_balance=100.
  
DO NOT RUN without reviewing the entry below.
"""

import boto3
from datetime import datetime, timezone
from decimal import Decimal
import uuid

USER_PK_HASH = "6992f531c1437f1fa3813ebc9ee940228b9045753c3851aad0ce7d65656f9d77"
CURRENT_BALANCE = Decimal("40")
REFUND_AMOUNT   = Decimal("60")
NEW_BALANCE     = CURRENT_BALANCE + REFUND_AMOUNT  # 100

now = datetime.now(timezone.utc)
timestamp = now.strftime("%Y-%m-%dT%H:%M:%S.000Z")
txn_id = f"REFUND_{int(now.timestamp() * 1000)}_{uuid.uuid4().hex[:8]}"

entry = {
    "PublicKey":             USER_PK_HASH,
    "DATE_TIME":             timestamp,
    "transaction_type":      "CREDIT",
    "TransactionAmount":     REFUND_AMOUNT,
    "prev_balance":          CURRENT_BALANCE,
    "new_balance":           NEW_BALANCE,
    "token_type":            "DAH",
    "transaction_id":        txn_id,
    "transaction_signature": "ADMIN_REFUND_failed_stake_records",
    "merchant_signature":    "ADMIN_REFUND_failed_stake_records",
    "memo":                  "REFUND:6_failed_dahbox_stakes_credential_error",
}

print("=== REFUND ENTRY TO BE WRITTEN ===")
for k, v in entry.items():
    print(f"  {k:28s}: {v}")

print(f"\nBalance change: {CURRENT_BALANCE} → {NEW_BALANCE} DAH (+{REFUND_AMOUNT})")
print("\nProceed? (yes/no): ", end="")
confirm = input().strip().lower()

if confirm != "yes":
    print("Aborted.")
    exit(0)

ddb = boto3.resource('dynamodb', region_name='us-east-1')
table = ddb.Table('ROLLEDGE_LEDGER')
table.put_item(Item=entry)
print(f"\n✅ CREDIT written. Transaction ID: {txn_id}")
print(f"   User balance restored to {NEW_BALANCE} DAH.")
