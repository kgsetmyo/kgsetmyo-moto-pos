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
