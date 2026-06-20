-- Moto POS — Initial Schema for Supabase PostgreSQL
-- Run in Supabase SQL Editor or via supabase db push

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('ADMIN', 'CASHIER');
CREATE TYPE payment_method AS ENUM ('CASH', 'MOBILE_BANKING', 'CREIT');
CREATE TYPE sale_status AS ENUM ('COMPLETED', 'VOIDED', 'REFUNDED');
CREATE TYPE credit_ledger_type AS ENUM ('SALE', 'PAYMENT', 'ADJUSTMENT');

-- ─── Profiles (extends auth.users) ───────────────────────────────────────────

CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  full_name   TEXT NOT NULL,
  role        user_role NOT NULL DEFAULT 'CASHIER',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
  IF meta_role IS NOT NULL AND meta_role <> '' THEN
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
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Catalog ─────────────────────────────────────────────────────────────────

CREATE TABLE brands (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku                  TEXT NOT NULL UNIQUE,
  barcode              TEXT UNIQUE,
  name                 TEXT NOT NULL,
  brand_id             UUID NOT NULL REFERENCES brands(id),
  category_id          UUID NOT NULL REFERENCES categories(id),
  low_stock_threshold  INT NOT NULL DEFAULT 5,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_name ON products USING gin (name gin_trgm_ops);
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;

-- ─── Bike Compatibility Matrix ───────────────────────────────────────────────

CREATE TABLE bike_brands (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bike_models (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bike_brand_id UUID NOT NULL REFERENCES bike_brands(id),
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bike_brand_id, name)
);

CREATE INDEX idx_bike_models_brand ON bike_models(bike_brand_id);

CREATE TABLE product_compatibilities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  bike_model_id UUID NOT NULL REFERENCES bike_models(id) ON DELETE CASCADE,
  year          INT NOT NULL CHECK (year >= 1980 AND year <= 2100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, bike_model_id, year)
);

CREATE INDEX idx_compat_bike_year ON product_compatibilities(bike_model_id, year);
CREATE INDEX idx_compat_product ON product_compatibilities(product_id);

-- ─── FIFO Inventory Batches ──────────────────────────────────────────────────

CREATE TABLE inventory_batches (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          UUID NOT NULL REFERENCES products(id),
  batch_number        TEXT,
  cost_price          NUMERIC(12,2) NOT NULL CHECK (cost_price >= 0),
  selling_price       NUMERIC(12,2) NOT NULL CHECK (selling_price >= 0),
  quantity_received   INT NOT NULL CHECK (quantity_received > 0),
  quantity_remaining  INT NOT NULL CHECK (quantity_remaining >= 0),
  received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes               TEXT,
  created_by          UUID REFERENCES profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_batch_remaining_lte_received
    CHECK (quantity_remaining <= quantity_received)
);

-- FIFO index: oldest batches with stock first
CREATE INDEX idx_batches_fifo ON inventory_batches(product_id, received_at ASC)
  WHERE quantity_remaining > 0;
CREATE INDEX idx_batches_product ON inventory_batches(product_id);

-- ─── Stock view (aggregated) ─────────────────────────────────────────────────

CREATE OR REPLACE VIEW product_stock_view AS
SELECT
  p.id AS product_id,
  p.sku,
  p.name,
  p.low_stock_threshold,
  COALESCE(SUM(b.quantity_remaining), 0)::INT AS total_stock,
  COALESCE(SUM(b.quantity_remaining), 0) < p.low_stock_threshold AS is_low_stock
FROM products p
LEFT JOIN inventory_batches b ON b.product_id = p.id AND b.quantity_remaining > 0
WHERE p.is_active = TRUE
GROUP BY p.id;

-- ─── Customers & Credit Ledger ───────────────────────────────────────────────

CREATE TABLE customers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  phone          TEXT,
  email          TEXT,
  address        TEXT,
  credit_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  credit_limit   NUMERIC(12,2),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_name ON customers USING gin (name gin_trgm_ops);
CREATE INDEX idx_customers_phone ON customers(phone);

CREATE TABLE daily_closes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_date  DATE NOT NULL UNIQUE,
  closed_by      UUID NOT NULL REFERENCES profiles(id),
  total_sales    NUMERIC(12,2) NOT NULL,
  cash_total     NUMERIC(12,2) NOT NULL,
  mobile_total   NUMERIC(12,2) NOT NULL,
  credit_total   NUMERIC(12,2) NOT NULL,
  total_cogs     NUMERIC(12,2) NOT NULL,
  gross_profit   NUMERIC(12,2) NOT NULL,
  expense_total  NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_profit     NUMERIC(12,2) NOT NULL,
  notes          TEXT,
  closed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Sales ───────────────────────────────────────────────────────────────────

CREATE TABLE sales (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  TEXT NOT NULL UNIQUE,
  customer_id     UUID REFERENCES customers(id),
  cashier_id      UUID NOT NULL REFERENCES profiles(id),
  subtotal        NUMERIC(12,2) NOT NULL,
  discount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL,
  total_cogs      NUMERIC(12,2) NOT NULL DEFAULT 0,
  gross_profit    NUMERIC(12,2) NOT NULL DEFAULT 0,
  status          sale_status NOT NULL DEFAULT 'COMPLETED',
  notes           TEXT,
  daily_close_id  UUID REFERENCES daily_closes(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sales_created ON sales(created_at DESC);
CREATE INDEX idx_sales_cashier ON sales(cashier_id);
CREATE INDEX idx_sales_customer ON sales(customer_id);

CREATE TABLE sale_line_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id     UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id),
  quantity    INT NOT NULL CHECK (quantity > 0),
  unit_price  NUMERIC(12,2) NOT NULL,
  line_total  NUMERIC(12,2) NOT NULL,
  total_cogs  NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX idx_line_items_sale ON sale_line_items(sale_id);

CREATE TABLE sale_batch_allocations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_line_item_id UUID NOT NULL REFERENCES sale_line_items(id) ON DELETE CASCADE,
  batch_id         UUID NOT NULL REFERENCES inventory_batches(id),
  quantity         INT NOT NULL CHECK (quantity > 0),
  unit_cost        NUMERIC(12,2) NOT NULL,
  subtotal_cogs    NUMERIC(12,2) NOT NULL
);

CREATE INDEX idx_allocations_line ON sale_batch_allocations(sale_line_item_id);
CREATE INDEX idx_allocations_batch ON sale_batch_allocations(batch_id);

CREATE TABLE payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id     UUID REFERENCES sales(id),
  customer_id UUID REFERENCES customers(id),
  method      payment_method NOT NULL,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  slip_url    TEXT,
  reference   TEXT,
  recorded_by UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_sale ON payments(sale_id);
CREATE INDEX idx_payments_created ON payments(created_at);

CREATE TABLE credit_ledger_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES customers(id),
  type          credit_ledger_type NOT NULL,
  amount        NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2) NOT NULL,
  sale_id       UUID REFERENCES sales(id),
  payment_id    UUID REFERENCES payments(id),
  notes         TEXT,
  recorded_by   UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_ledger_customer ON credit_ledger_entries(customer_id, created_at DESC);

CREATE TABLE expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category     TEXT NOT NULL,
  description  TEXT,
  amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  expense_date DATE NOT NULL,
  recorded_by  UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expenses_date ON expenses(expense_date);

CREATE TABLE shop_settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  phone         TEXT,
  address       TEXT,
  logo_url      TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── FIFO Deduction Function (atomic) ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION fifo_allocate_stock(
  p_product_id UUID,
  p_quantity INT
)
RETURNS TABLE (
  batch_id UUID,
  quantity INT,
  unit_cost NUMERIC,
  subtotal_cogs NUMERIC
) AS $$
DECLARE
  v_remaining INT := p_quantity;
  v_batch RECORD;
  v_take INT;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;

  FOR v_batch IN
    SELECT id, quantity_remaining, cost_price
    FROM inventory_batches
    WHERE product_id = p_product_id AND quantity_remaining > 0
    ORDER BY received_at ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_take := LEAST(v_batch.quantity_remaining, v_remaining);

    UPDATE inventory_batches
    SET quantity_remaining = quantity_remaining - v_take
    WHERE id = v_batch.id;

    batch_id := v_batch.id;
    quantity := v_take;
    unit_cost := v_batch.cost_price;
    subtotal_cogs := v_take * v_batch.cost_price;
    RETURN NEXT;

    v_remaining := v_remaining - v_take;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Insufficient stock for product %. Short by %', p_product_id, v_remaining;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ─── Invoice number sequence ───────────────────────────────────────────────────

CREATE SEQUENCE invoice_number_seq START 10001;

CREATE OR REPLACE FUNCTION next_invoice_number()
RETURNS TEXT AS $$
  SELECT 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('invoice_number_seq')::TEXT, 5, '0');
$$ LANGUAGE SQL;

-- ─── Row Level Security ──────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read profiles"
  ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Authenticated full access to products"
  ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access to inventory"
  ON inventory_batches FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access to sales"
  ON sales FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access to customers"
  ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket for mobile banking slips (create in Supabase dashboard)
-- INSERT policy: authenticated users can upload to slips/{sale_id}/
