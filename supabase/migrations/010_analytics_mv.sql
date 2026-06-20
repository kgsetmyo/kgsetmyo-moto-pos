-- Phase 2: Analytics materialized views + nightly refresh (Asia/Yangon business dates).
-- Safe to re-run (idempotent where noted).

-- ─── Daily sales rollup ───────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_sales_analytics AS
SELECT
  (s.created_at AT TIME ZONE 'Asia/Yangon')::date AS business_date,
  COUNT(*)::int AS sale_count,
  COALESCE(SUM(s.total), 0)::numeric(14, 2) AS revenue,
  COALESCE(SUM(s.total_cogs), 0)::numeric(14, 2) AS cogs,
  COALESCE(SUM(s.gross_profit), 0)::numeric(14, 2) AS gross_profit
FROM sales s
WHERE s.status = 'COMPLETED'
GROUP BY (s.created_at AT TIME ZONE 'Asia/Yangon')::date;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_sales_analytics_date
  ON mv_daily_sales_analytics (business_date);

COMMENT ON MATERIALIZED VIEW mv_daily_sales_analytics IS
  'Pre-aggregated daily revenue, COGS, and gross profit for analytics dashboards';

-- ─── Daily category breakdown ─────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_category_sales AS
SELECT
  (s.created_at AT TIME ZONE 'Asia/Yangon')::date AS business_date,
  c.id AS category_id,
  c.name AS category_name,
  COALESCE(SUM(sli.line_total), 0)::numeric(14, 2) AS revenue,
  COALESCE(SUM(sli.quantity), 0)::int AS units_sold
FROM sale_line_items sli
JOIN sales s ON s.id = sli.sale_id AND s.status = 'COMPLETED'
JOIN products p ON p.id = sli.product_id
JOIN categories c ON c.id = p.category_id
GROUP BY
  (s.created_at AT TIME ZONE 'Asia/Yangon')::date,
  c.id,
  c.name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_category_sales_pk
  ON mv_daily_category_sales (business_date, category_id);

COMMENT ON MATERIALIZED VIEW mv_daily_category_sales IS
  'Daily revenue and units sold per product category';

-- ─── Refresh helper (service_role / migrations only) ────────────────────────
CREATE OR REPLACE FUNCTION refresh_analytics_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_sales_analytics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_category_sales;
END;
$$;

COMMENT ON FUNCTION refresh_analytics_materialized_views IS
  'Refresh analytics MVs; scheduled nightly via pg_cron when extension is enabled';

GRANT EXECUTE ON FUNCTION refresh_analytics_materialized_views TO service_role;

-- ─── pg_cron: 02:00 Asia/Yangon ≈ 19:30 UTC ───────────────────────────────────
-- Requires pg_cron (Supabase Dashboard → Database → Extensions).
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'refresh-analytics-mv';

    PERFORM cron.schedule(
      'refresh-analytics-mv',
      '30 19 * * *',
      $$SELECT refresh_analytics_materialized_views()$$
    );
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_function THEN
    RAISE NOTICE 'pg_cron not available — enable extension and re-run schedule block';
END;
$cron$;

-- Initial populate
REFRESH MATERIALIZED VIEW mv_daily_sales_analytics;
REFRESH MATERIALIZED VIEW mv_daily_category_sales;
