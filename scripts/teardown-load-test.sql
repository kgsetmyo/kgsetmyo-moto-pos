-- Idempotent teardown for load-test sales on STAGING only.
-- Targets sales where notes = 'Load test automated transaction'.
-- Restores FIFO stock, reverses credit balances, then removes sale records.
--
-- Usage: Supabase Dashboard → SQL Editor → Run
-- Or:    psql $DIRECT_URL -f scripts/teardown-load-test.sql

BEGIN;

-- 1. Restore FIFO quantities from batch allocations
UPDATE inventory_batches ib
SET quantity_remaining = ib.quantity_remaining + sba.quantity
FROM sale_batch_allocations sba
JOIN sale_line_items sli ON sba.sale_line_item_id = sli.id
JOIN sales s ON sli.sale_id = s.id
WHERE s.notes = 'Load test automated transaction'
  AND ib.id = sba.batch_id;

-- 2. Reverse customer credit balances for CREDIT payments on load-test sales
WITH credit_payments AS (
  SELECT p.customer_id, SUM(p.amount) AS credit_amount
  FROM payments p
  JOIN sales s ON p.sale_id = s.id
  WHERE s.notes = 'Load test automated transaction'
    AND p.method = 'CREDIT'
    AND p.customer_id IS NOT NULL
  GROUP BY p.customer_id
)
UPDATE customers c
SET credit_balance = c.credit_balance - cp.credit_amount
FROM credit_payments cp
WHERE c.id = cp.customer_id;

-- 3. Remove ledger entries tied to load-test sales
DELETE FROM credit_ledger_entries cle
USING sales s
WHERE cle.sale_id = s.id
  AND s.notes = 'Load test automated transaction';

-- 4. Remove payments for load-test sales
DELETE FROM payments p
USING sales s
WHERE p.sale_id = s.id
  AND s.notes = 'Load test automated transaction';

-- 5. Delete sales (cascades sale_line_items and sale_batch_allocations)
DELETE FROM sales
WHERE notes = 'Load test automated transaction';

COMMIT;
