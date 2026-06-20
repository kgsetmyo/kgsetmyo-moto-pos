-- Fix auth signup trigger: safe role cast + conflict handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role user_role := 'CASHIER';
  meta_role TEXT;
BEGIN
  meta_role := NEW.raw_user_meta_data->>'role';

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
