-- Phase 2: B2C storefront + click & collect (web orders with FIFO reservation).
-- Safe to re-run where noted.

-- ─── Enums ────────────────────────────────────────────────────────────────────
DO $enum$
BEGIN
  CREATE TYPE sale_source AS ENUM ('IN_STORE', 'WEB');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$enum$;

DO $enum$
BEGIN
  CREATE TYPE fulfillment_status AS ENUM ('PENDING', 'PICKED', 'COMPLETED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$enum$;

DO $enum$
BEGIN
  ALTER TYPE user_role ADD VALUE 'CUSTOMER';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$enum$;

-- ─── Sales omnichannel columns ────────────────────────────────────────────────
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS source sale_source NOT NULL DEFAULT 'IN_STORE',
  ADD COLUMN IF NOT EXISTS fulfillment_status fulfillment_status NOT NULL DEFAULT 'COMPLETED';

ALTER TABLE sales ALTER COLUMN cashier_id DROP NOT NULL;

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_cashier_required;
ALTER TABLE sales ADD CONSTRAINT sales_cashier_required
  CHECK (source = 'WEB' OR cashier_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_sales_web_pending
  ON sales (created_at DESC)
  WHERE source = 'WEB' AND fulfillment_status IN ('PENDING', 'PICKED');

-- ─── Customer accounts (Supabase Auth link) ───────────────────────────────────
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);

-- ─── Auth trigger: honour customer signups ────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role user_role := 'CASHIER';
  meta_role TEXT;
  account_type TEXT;
BEGIN
  account_type := NEW.raw_user_meta_data->>'account_type';
  meta_role := NEW.raw_user_meta_data->>'role';

  IF account_type = 'customer' THEN
    assigned_role := 'CUSTOMER';
  ELSIF meta_role IS NOT NULL AND meta_role <> '' THEN
    BEGIN
      assigned_role := meta_role::user_role;
    EXCEPTION WHEN OTHERS THEN
      assigned_role := 'CASHIER';
    END;
  END IF;

  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    assigned_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ─── In-store checkout: stamp source + fulfillment ──────────────────────────
CREATE OR REPLACE FUNCTION create_sale_with_fifo(
  p_cashier_id UUID,
  p_lines JSONB,
  p_payments JSONB,
  p_customer_id UUID DEFAULT NULL,
  p_discount NUMERIC DEFAULT 0,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice TEXT;
  v_sale_id UUID;
  v_subtotal NUMERIC := 0;
  v_total_cogs NUMERIC := 0;
  v_total NUMERIC;
  v_gross_profit NUMERIC;
  v_line JSONB;
  v_product_id UUID;
  v_qty INT;
  v_unit_price NUMERIC;
  v_line_total NUMERIC;
  v_line_cogs NUMERIC;
  v_line_item_id UUID;
  v_alloc RECORD;
  v_remaining INT;
  v_take INT;
  v_payment JSONB;
  v_payment_total NUMERIC := 0;
  v_new_balance NUMERIC;
  v_result JSONB;
  v_business_date DATE;
  v_credit_total NUMERIC := 0;
  v_credit_balance NUMERIC;
  v_credit_limit NUMERIC;
BEGIN
  v_business_date := (NOW() AT TIME ZONE 'Asia/Yangon')::DATE;

  IF EXISTS (SELECT 1 FROM daily_closes WHERE business_date = v_business_date) THEN
    RAISE EXCEPTION 'Business day % is already closed', v_business_date;
  END IF;

  IF jsonb_array_length(p_lines) < 1 THEN
    RAISE EXCEPTION 'Sale must have at least one line item';
  END IF;

  v_invoice := next_invoice_number();

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) AS t(value)
  LOOP
    v_subtotal := v_subtotal
      + (v_line->>'quantity')::INT * (v_line->>'unitPrice')::NUMERIC;
  END LOOP;

  v_total := v_subtotal - COALESCE(p_discount, 0);

  SELECT COALESCE(SUM((value->>'amount')::NUMERIC), 0) INTO v_credit_total
  FROM jsonb_array_elements(p_payments) AS t(value)
  WHERE (value->>'method') = 'CREDIT';

  IF v_credit_total > 0 AND p_customer_id IS NULL THEN
    RAISE EXCEPTION 'Customer required for credit payments';
  END IF;

  IF v_credit_total > 0 THEN
    SELECT credit_balance, credit_limit
    INTO v_credit_balance, v_credit_limit
    FROM customers
    WHERE id = p_customer_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Customer not found';
    END IF;

    IF v_credit_limit IS NOT NULL
       AND v_credit_balance + v_credit_total > v_credit_limit THEN
      RAISE EXCEPTION 'Credit limit exceeded (limit: %, balance: %, credit sale: %)',
        v_credit_limit, v_credit_balance, v_credit_total;
    END IF;
  END IF;

  INSERT INTO sales (
    invoice_number, customer_id, cashier_id,
    subtotal, discount, total, total_cogs, gross_profit, notes,
    source, fulfillment_status
  )
  VALUES (
    v_invoice, p_customer_id, p_cashier_id,
    v_subtotal, COALESCE(p_discount, 0), v_total, 0, 0, p_notes,
    'IN_STORE', 'COMPLETED'
  )
  RETURNING id INTO v_sale_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) AS t(value)
  LOOP
    v_product_id := (v_line->>'productId')::UUID;
    v_qty := (v_line->>'quantity')::INT;
    v_unit_price := (v_line->>'unitPrice')::NUMERIC;
    v_line_total := v_qty * v_unit_price;
    v_line_cogs := 0;
    v_remaining := v_qty;

    INSERT INTO sale_line_items (
      sale_id, product_id, quantity, unit_price, line_total, total_cogs
    )
    VALUES (v_sale_id, v_product_id, v_qty, v_unit_price, v_line_total, 0)
    RETURNING id INTO v_line_item_id;

    FOR v_alloc IN
      SELECT id, quantity_remaining, cost_price
      FROM inventory_batches
      WHERE product_id = v_product_id AND quantity_remaining > 0
      ORDER BY received_at ASC, created_at ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_alloc.quantity_remaining, v_remaining);

      UPDATE inventory_batches
      SET quantity_remaining = quantity_remaining - v_take
      WHERE id = v_alloc.id;

      INSERT INTO sale_batch_allocations (
        sale_line_item_id, batch_id, quantity, unit_cost, subtotal_cogs
      )
      VALUES (
        v_line_item_id, v_alloc.id, v_take,
        v_alloc.cost_price, v_take * v_alloc.cost_price
      );

      v_line_cogs := v_line_cogs + v_take * v_alloc.cost_price;
      v_remaining := v_remaining - v_take;
    END LOOP;

    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_product_id;
    END IF;

    UPDATE sale_line_items SET total_cogs = v_line_cogs WHERE id = v_line_item_id;
    v_total_cogs := v_total_cogs + v_line_cogs;
  END LOOP;

  v_gross_profit := v_total - v_total_cogs;
  UPDATE sales
  SET total_cogs = v_total_cogs, gross_profit = v_gross_profit
  WHERE id = v_sale_id;

  FOR v_payment IN SELECT value FROM jsonb_array_elements(p_payments) AS t(value)
  LOOP
    v_payment_total := v_payment_total + (v_payment->>'amount')::NUMERIC;

    INSERT INTO payments (
      sale_id, customer_id, method, amount, slip_url, reference, recorded_by
    )
    VALUES (
      v_sale_id,
      p_customer_id,
      (v_payment->>'method')::payment_method,
      (v_payment->>'amount')::NUMERIC,
      NULLIF(v_payment->>'slipUrl', ''),
      NULLIF(v_payment->>'reference', ''),
      p_cashier_id
    );

    IF (v_payment->>'method') = 'CREDIT' AND p_customer_id IS NOT NULL THEN
      SELECT credit_balance INTO v_new_balance
      FROM customers WHERE id = p_customer_id FOR UPDATE;

      v_new_balance := v_new_balance + (v_payment->>'amount')::NUMERIC;

      UPDATE customers SET credit_balance = v_new_balance WHERE id = p_customer_id;

      INSERT INTO credit_ledger_entries (
        customer_id, type, amount, balance_after, sale_id, recorded_by
      )
      VALUES (
        p_customer_id, 'SALE',
        (v_payment->>'amount')::NUMERIC,
        v_new_balance, v_sale_id, p_cashier_id
      );
    END IF;
  END LOOP;

  IF ABS(v_payment_total - v_total) > 0.01 THEN
    RAISE EXCEPTION 'Payment total does not match sale total';
  END IF;

  SELECT jsonb_build_object(
    'id', s.id,
    'invoiceNumber', s.invoice_number,
    'invoice_number', s.invoice_number,
    'subtotal', s.subtotal,
    'discount', s.discount,
    'total', s.total,
    'totalCogs', s.total_cogs,
    'total_cogs', s.total_cogs,
    'grossProfit', s.gross_profit,
    'gross_profit', s.gross_profit,
    'source', s.source,
    'fulfillmentStatus', s.fulfillment_status,
    'fulfillment_status', s.fulfillment_status,
    'createdAt', s.created_at,
    'created_at', s.created_at,
    'lineItems', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', sli.id,
          'quantity', sli.quantity,
          'unitPrice', sli.unit_price,
          'unit_price', sli.unit_price,
          'lineTotal', sli.line_total,
          'line_total', sli.line_total,
          'product', jsonb_build_object('name', p.name, 'sku', p.sku)
        )
      )
      FROM sale_line_items sli
      JOIN products p ON p.id = sli.product_id
      WHERE sli.sale_id = s.id
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM sales s
  WHERE s.id = v_sale_id;

  RETURN v_result;
END;
$$;

-- ─── Web order: FIFO reserve + PENDING fulfillment ────────────────────────────
CREATE OR REPLACE FUNCTION create_web_order_with_fifo(
  p_customer_id UUID,
  p_lines JSONB,
  p_payments JSONB DEFAULT '[]'::jsonb,
  p_discount NUMERIC DEFAULT 0,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice TEXT;
  v_sale_id UUID;
  v_subtotal NUMERIC := 0;
  v_total_cogs NUMERIC := 0;
  v_total NUMERIC;
  v_gross_profit NUMERIC;
  v_line JSONB;
  v_product_id UUID;
  v_qty INT;
  v_unit_price NUMERIC;
  v_line_total NUMERIC;
  v_line_cogs NUMERIC;
  v_line_item_id UUID;
  v_alloc RECORD;
  v_remaining INT;
  v_take INT;
  v_payment JSONB;
  v_payment_total NUMERIC := 0;
  v_result JSONB;
BEGIN
  IF p_customer_id IS NULL THEN
    RAISE EXCEPTION 'Customer required for web orders';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id AND is_active = TRUE) THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  IF jsonb_array_length(p_lines) < 1 THEN
    RAISE EXCEPTION 'Order must have at least one line item';
  END IF;

  v_invoice := next_invoice_number();

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) AS t(value)
  LOOP
    v_subtotal := v_subtotal
      + (v_line->>'quantity')::INT * (v_line->>'unitPrice')::NUMERIC;
  END LOOP;

  v_total := v_subtotal - COALESCE(p_discount, 0);

  INSERT INTO sales (
    invoice_number, customer_id, cashier_id,
    subtotal, discount, total, total_cogs, gross_profit, notes,
    source, fulfillment_status
  )
  VALUES (
    v_invoice, p_customer_id, NULL,
    v_subtotal, COALESCE(p_discount, 0), v_total, 0, 0, p_notes,
    'WEB', 'PENDING'
  )
  RETURNING id INTO v_sale_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) AS t(value)
  LOOP
    v_product_id := (v_line->>'productId')::UUID;
    v_qty := (v_line->>'quantity')::INT;
    v_unit_price := (v_line->>'unitPrice')::NUMERIC;
    v_line_total := v_qty * v_unit_price;
    v_line_cogs := 0;
    v_remaining := v_qty;

    INSERT INTO sale_line_items (
      sale_id, product_id, quantity, unit_price, line_total, total_cogs
    )
    VALUES (v_sale_id, v_product_id, v_qty, v_unit_price, v_line_total, 0)
    RETURNING id INTO v_line_item_id;

    FOR v_alloc IN
      SELECT id, quantity_remaining, cost_price
      FROM inventory_batches
      WHERE product_id = v_product_id AND quantity_remaining > 0
      ORDER BY received_at ASC, created_at ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_alloc.quantity_remaining, v_remaining);

      UPDATE inventory_batches
      SET quantity_remaining = quantity_remaining - v_take
      WHERE id = v_alloc.id;

      INSERT INTO sale_batch_allocations (
        sale_line_item_id, batch_id, quantity, unit_cost, subtotal_cogs
      )
      VALUES (
        v_line_item_id, v_alloc.id, v_take,
        v_alloc.cost_price, v_take * v_alloc.cost_price
      );

      v_line_cogs := v_line_cogs + v_take * v_alloc.cost_price;
      v_remaining := v_remaining - v_take;
    END LOOP;

    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_product_id;
    END IF;

    UPDATE sale_line_items SET total_cogs = v_line_cogs WHERE id = v_line_item_id;
    v_total_cogs := v_total_cogs + v_line_cogs;
  END LOOP;

  v_gross_profit := v_total - v_total_cogs;
  UPDATE sales
  SET total_cogs = v_total_cogs, gross_profit = v_gross_profit
  WHERE id = v_sale_id;

  FOR v_payment IN SELECT value FROM jsonb_array_elements(COALESCE(p_payments, '[]'::jsonb)) AS t(value)
  LOOP
    IF (v_payment->>'method') = 'CREDIT' THEN
      RAISE EXCEPTION 'Credit payments are not allowed for web orders';
    END IF;

    v_payment_total := v_payment_total + (v_payment->>'amount')::NUMERIC;

    INSERT INTO payments (
      sale_id, customer_id, method, amount, slip_url, reference, recorded_by
    )
    VALUES (
      v_sale_id,
      p_customer_id,
      (v_payment->>'method')::payment_method,
      (v_payment->>'amount')::NUMERIC,
      NULLIF(v_payment->>'slipUrl', ''),
      NULLIF(v_payment->>'reference', ''),
      NULL
    );
  END LOOP;

  IF v_payment_total > v_total + 0.01 THEN
    RAISE EXCEPTION 'Payment total exceeds order total';
  END IF;

  SELECT jsonb_build_object(
    'id', s.id,
    'invoiceNumber', s.invoice_number,
    'invoice_number', s.invoice_number,
    'total', s.total,
    'source', s.source,
    'fulfillmentStatus', s.fulfillment_status,
    'fulfillment_status', s.fulfillment_status,
    'createdAt', s.created_at,
    'created_at', s.created_at,
    'lineItems', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'quantity', sli.quantity,
          'unitPrice', sli.unit_price,
          'lineTotal', sli.line_total,
          'product', jsonb_build_object('name', p.name, 'sku', p.sku)
        )
      )
      FROM sale_line_items sli
      JOIN products p ON p.id = sli.product_id
      WHERE sli.sale_id = s.id
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM sales s
  WHERE s.id = v_sale_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION create_web_order_with_fifo TO service_role;

-- ─── Cashier fulfillment workflow ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_web_order_fulfillment(
  p_sale_id UUID,
  p_cashier_id UUID,
  p_action TEXT,
  p_payments JSONB DEFAULT '[]'::jsonb,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale sales%ROWTYPE;
  v_payment JSONB;
  v_payment_total NUMERIC := 0;
  v_existing_paid NUMERIC := 0;
  v_remaining NUMERIC;
  v_result JSONB;
BEGIN
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_sale.source <> 'WEB' THEN
    RAISE EXCEPTION 'Not a web order';
  END IF;

  IF v_sale.status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'Order is not active';
  END IF;

  IF p_action = 'PICK' THEN
    IF v_sale.fulfillment_status <> 'PENDING' THEN
      RAISE EXCEPTION 'Order is not pending pick';
    END IF;

    UPDATE sales
    SET fulfillment_status = 'PICKED', cashier_id = p_cashier_id
    WHERE id = p_sale_id;

  ELSIF p_action = 'COMPLETE' THEN
    IF v_sale.fulfillment_status NOT IN ('PENDING', 'PICKED') THEN
      RAISE EXCEPTION 'Order cannot be completed from status %', v_sale.fulfillment_status;
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_existing_paid
    FROM payments WHERE sale_id = p_sale_id;

    FOR v_payment IN SELECT value FROM jsonb_array_elements(COALESCE(p_payments, '[]'::jsonb)) AS t(value)
    LOOP
      v_payment_total := v_payment_total + (v_payment->>'amount')::NUMERIC;

      INSERT INTO payments (
        sale_id, customer_id, method, amount, slip_url, reference, recorded_by
      )
      VALUES (
        p_sale_id,
        v_sale.customer_id,
        (v_payment->>'method')::payment_method,
        (v_payment->>'amount')::NUMERIC,
        NULLIF(v_payment->>'slipUrl', ''),
        NULLIF(v_payment->>'reference', ''),
        p_cashier_id
      );
    END LOOP;

    v_remaining := v_sale.total - v_existing_paid - v_payment_total;
    IF ABS(v_remaining) > 0.01 THEN
      RAISE EXCEPTION 'Payment total does not match order balance (remaining: %)', v_remaining;
    END IF;

    UPDATE sales
    SET fulfillment_status = 'COMPLETED', cashier_id = COALESCE(cashier_id, p_cashier_id)
    WHERE id = p_sale_id;

  ELSIF p_action = 'CANCEL' THEN
    IF v_sale.fulfillment_status = 'COMPLETED' THEN
      RAISE EXCEPTION 'Completed orders cannot be cancelled';
    END IF;

    PERFORM void_sale_with_fifo(p_sale_id, p_cashier_id, COALESCE(p_reason, 'Web order cancelled'));

    UPDATE sales SET fulfillment_status = 'CANCELLED' WHERE id = p_sale_id;

  ELSE
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;

  SELECT jsonb_build_object(
    'id', s.id,
    'invoiceNumber', s.invoice_number,
    'fulfillmentStatus', s.fulfillment_status,
    'fulfillment_status', s.fulfillment_status,
    'total', s.total,
    'status', s.status
  )
  INTO v_result
  FROM sales s
  WHERE s.id = p_sale_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION update_web_order_fulfillment TO service_role;

COMMENT ON FUNCTION create_web_order_with_fifo IS
  'Click & collect: FIFO stock reservation with PENDING fulfillment until pickup';

COMMENT ON FUNCTION update_web_order_fulfillment IS
  'Cashier actions: PICK, COMPLETE (collect payment), CANCEL (void + restore stock)';
