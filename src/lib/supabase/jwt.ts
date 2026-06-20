export type SupabaseJwtPayload = {
  sub?: string;
  email?: string;
  exp?: number;
  iss?: string;
  aud?: string | string[];
  role?: string;
};

const JWT_LEEWAY_SEC = 30;

function base64UrlDecodeToBytes(b64: string): Uint8Array {
  const base64 = b64.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;

  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(padded, "base64"));
  }

  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlDecodeToString(b64: string): string {
  const bytes = base64UrlDecodeToBytes(b64);
  return new TextDecoder().decode(bytes);
}

export function decodeJwtPayload(token: string): SupabaseJwtPayload | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    return JSON.parse(base64UrlDecodeToString(parts[1])) as SupabaseJwtPayload;
  } catch {
    return null;
  }
}

function isExpired(payload: SupabaseJwtPayload): boolean {
  if (!payload.exp) return true;
  return payload.exp < Math.floor(Date.now() / 1000) - JWT_LEEWAY_SEC;
}

function expectedIssuer(): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/auth/v1`;
}

function issuerMatches(payload: SupabaseJwtPayload): boolean {
  const expected = expectedIssuer();
  if (!expected || !payload.iss) return true;
  return payload.iss === expected;
}

async function verifyHs256Signature(token: string, secret: string): Promise<boolean> {
  const [headerB64, payloadB64, signatureB64] = token.split(".");
  if (!headerB64 || !payloadB64 || !signatureB64) return false;

  let header: { alg?: string };
  try {
    header = JSON.parse(base64UrlDecodeToString(headerB64)) as { alg?: string };
  } catch {
    return false;
  }

  if (header.alg !== "HS256") return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = new Uint8Array(base64UrlDecodeToBytes(signatureB64));
  return crypto.subtle.verify("HMAC", key, signature, data);
}

/**
 * Validates a Supabase access token locally (exp, issuer, role, optional HS256 signature).
 * Set SUPABASE_JWT_SECRET for full signature verification in production.
 */
export async function validateAccessToken(token: string): Promise<SupabaseJwtPayload | null> {
  const payload = decodeJwtPayload(token);
  if (!payload?.sub) return null;
  if (isExpired(payload)) return null;
  if (!issuerMatches(payload)) return null;
  if (payload.role && payload.role !== "authenticated") return null;

  const secret = process.env.SUPABASE_JWT_SECRET?.trim();
  if (secret) {
    const valid = await verifyHs256Signature(token, secret);
    if (!valid) return null;
  }

  return payload;
}
