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
