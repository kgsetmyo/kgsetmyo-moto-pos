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
