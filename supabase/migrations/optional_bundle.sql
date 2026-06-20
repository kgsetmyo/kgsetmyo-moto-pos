-- ========== 008_payment_method_credit.sql ==========
-- Some older installs created payment_method without CREDIT.
-- Idempotent: add CREDIT if missing (required for credit sales).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'payment_method'
      AND e.enumlabel = 'CREDIT'
  ) THEN
    ALTER TYPE payment_method ADD VALUE 'CREDIT';
  END IF;
END $$;

-- ========== 005_record_credit_payment.sql ==========
-- Atomic credit payment: balance update + payment row + ledger entry in one transaction.

CREATE OR REPLACE FUNCTION record_credit_payment(
  p_customer_id UUID,
  p_amount NUMERIC,
  p_method payment_method,
  p_reference TEXT,
  p_notes TEXT,
  p_recorded_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
  v_new_balance NUMERIC;
  v_payment_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive';
  END IF;

  IF p_method NOT IN ('CASH', 'MOBILE_BANKING') THEN
    RAISE EXCEPTION 'Invalid payment method for credit collection';
  END IF;

  SELECT credit_balance INTO v_balance
  FROM customers
  WHERE id = p_customer_id AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  v_new_balance := v_balance - p_amount;
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Payment exceeds credit balance';
  END IF;

  INSERT INTO payments (customer_id, method, amount, reference, recorded_by)
  VALUES (p_customer_id, p_method, p_amount, p_reference, p_recorded_by)
  RETURNING id INTO v_payment_id;

  UPDATE customers SET credit_balance = v_new_balance WHERE id = p_customer_id;

  INSERT INTO credit_ledger_entries (
    customer_id, type, amount, balance_after, payment_id, notes, recorded_by
  ) VALUES (
    p_customer_id, 'PAYMENT', -p_amount, v_new_balance, v_payment_id, p_notes, p_recorded_by
  );

  RETURN jsonb_build_object(
    'paymentId', v_payment_id,
    'newBalance', v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION record_credit_payment TO service_role;

-- ========== 006_inventory_adjustments.sql ==========
-- Stock write-off / damage adjustments with audit log.

CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES products(id),
  quantity_removed INT NOT NULL CHECK (quantity_removed > 0),
  reason           TEXT NOT NULL,
  recorded_by      UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_product ON inventory_adjustments(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_created ON inventory_adjustments(created_at DESC);

ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read inventory_adjustments"
  ON inventory_adjustments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated insert inventory_adjustments"
  ON inventory_adjustments FOR INSERT TO authenticated WITH CHECK (true);

-- ========== 007_void_sale_rpc.sql ==========
-- Void a completed sale: restore FIFO stock and reverse credit ledger entries.

CREATE OR REPLACE FUNCTION void_sale_with_fifo(
  p_sale_id UUID,
  p_voided_by UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale sales%ROWTYPE;
  v_alloc RECORD;
  v_payment RECORD;
  v_new_balance NUMERIC;
  v_result JSONB;
BEGIN
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  IF v_sale.status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'Only completed sales can be voided';
  END IF;

  IF v_sale.daily_close_id IS NOT NULL THEN
    RAISE EXCEPTION 'Sale is locked by daily close';
  END IF;

  FOR v_alloc IN
    SELECT sba.batch_id, sba.quantity
    FROM sale_batch_allocations sba
    JOIN sale_line_items sli ON sli.id = sba.sale_line_item_id
    WHERE sli.sale_id = p_sale_id
  LOOP
    UPDATE inventory_batches
    SET quantity_remaining = quantity_remaining + v_alloc.quantity
    WHERE id = v_alloc.batch_id;
  END LOOP;

  FOR v_payment IN
    SELECT *
    FROM payments
    WHERE sale_id = p_sale_id AND method = 'CREDIT' AND customer_id IS NOT NULL
  LOOP
    SELECT credit_balance INTO v_new_balance
    FROM customers WHERE id = v_payment.customer_id FOR UPDATE;

    v_new_balance := v_new_balance - v_payment.amount;

    UPDATE customers SET credit_balance = v_new_balance WHERE id = v_payment.customer_id;

    INSERT INTO credit_ledger_entries (
      customer_id, type, amount, balance_after, sale_id, recorded_by, notes
    )
    VALUES (
      v_payment.customer_id,
      'ADJUSTMENT',
      -v_payment.amount,
      v_new_balance,
      p_sale_id,
      p_voided_by,
      COALESCE(NULLIF(p_reason, ''), 'Sale voided')
    );
  END LOOP;

  UPDATE sales
  SET
    status = 'VOIDED',
    notes = CASE
      WHEN p_reason IS NOT NULL AND p_reason <> '' THEN
        COALESCE(v_sale.notes || E'\n', '') || 'VOID: ' || p_reason
      ELSE COALESCE(v_sale.notes || E'\n', '') || 'VOIDED'
    END
  WHERE id = p_sale_id;

  SELECT jsonb_build_object(
    'id', s.id,
    'invoiceNumber', s.invoice_number,
    'invoice_number', s.invoice_number,
    'status', s.status,
    'total', s.total
  )
  INTO v_result
  FROM sales s
  WHERE s.id = p_sale_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION void_sale_with_fifo TO service_role;
