/**
 * Test account credentials — must be set in .env / .env.local (never hardcoded).
 */
export function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`❌ Missing required env: ${name} (set in .env or .env.local)`);
    process.exit(1);
  }
  return value;
}

export function getAdminCredentials() {
  return {
    email: requireEnv("ADMIN_EMAIL"),
    password: requireEnv("ADMIN_PASSWORD"),
  };
}

export function getCashierCredentials() {
  return {
    email: requireEnv("CASHIER_EMAIL"),
    password: requireEnv("CASHIER_PASSWORD"),
  };
}
