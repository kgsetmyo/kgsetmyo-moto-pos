-- Seed sample data for development
-- Run after 001_initial_schema.sql

INSERT INTO brands (name) VALUES ('NGK'), ('Denso'), ('OEM') ON CONFLICT DO NOTHING;
INSERT INTO categories (name) VALUES ('Spark Plug'), ('Oil Filter'), ('Brake Pad') ON CONFLICT DO NOTHING;

INSERT INTO bike_brands (name) VALUES ('Honda'), ('Yamaha') ON CONFLICT DO NOTHING;

INSERT INTO bike_models (bike_brand_id, name)
SELECT bb.id, m.name
FROM bike_brands bb
CROSS JOIN (VALUES ('Click'), ('Wave'), ('Scoopy')) AS m(name)
WHERE bb.name = 'Honda'
ON CONFLICT DO NOTHING;

INSERT INTO bike_models (bike_brand_id, name)
SELECT bb.id, m.name
FROM bike_brands bb
CROSS JOIN (VALUES ('NMAX'), ('Aerox')) AS m(name)
WHERE bb.name = 'Yamaha'
ON CONFLICT DO NOTHING;

-- Sample product
INSERT INTO products (sku, barcode, name, brand_id, category_id, low_stock_threshold)
SELECT
  'SP-CLICK-001',
  '8851234567890',
  'Spark Plug Click 125',
  b.id,
  c.id,
  10
FROM brands b, categories c
WHERE b.name = 'NGK' AND c.name = 'Spark Plug'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO product_compatibilities (product_id, bike_model_id, year)
SELECT p.id, bm.id, y.year
FROM products p
JOIN bike_models bm ON bm.name = 'Click'
JOIN bike_brands bb ON bb.id = bm.bike_brand_id AND bb.name = 'Honda'
CROSS JOIN (VALUES (2020), (2021), (2022), (2023)) AS y(year)
WHERE p.sku = 'SP-CLICK-001'
ON CONFLICT DO NOTHING;

INSERT INTO inventory_batches (product_id, cost_price, selling_price, quantity_received, quantity_remaining)
SELECT p.id, 2500, 4500, 50, 50
FROM products p WHERE p.sku = 'SP-CLICK-001';

INSERT INTO shop_settings (business_name, phone, address)
VALUES ('Moto Parts Yangon', '09-xxx-xxx', 'Yangon, Myanmar')
ON CONFLICT DO NOTHING;
