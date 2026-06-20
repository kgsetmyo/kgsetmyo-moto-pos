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
