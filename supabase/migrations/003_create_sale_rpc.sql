-- Atomic FIFO checkout callable via supabase.rpc('create_sale_with_fifo', ...)
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
BEGIN
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

  INSERT INTO sales (
    invoice_number, customer_id, cashier_id,
    subtotal, discount, total, total_cogs, gross_profit, notes
  )
  VALUES (
    v_invoice, p_customer_id, p_cashier_id,
    v_subtotal, COALESCE(p_discount, 0), v_total, 0, 0, p_notes
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

-- Storage bucket for mobile banking slips
INSERT INTO storage.buckets (id, name, public)
VALUES ('slips', 'slips', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload slips"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'slips');

CREATE POLICY "Public read slips"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'slips');
