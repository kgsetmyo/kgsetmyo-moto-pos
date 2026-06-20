import { cookies } from "next/headers";
import { combineChunks, stringFromBase64URL } from "@supabase/ssr";

const BASE64_PREFIX = "base64-";

export type AuthFromCookies = {
  userId: string;
  email?: string;
  accessToken?: string;
};

function storageKey() {
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
  return `sb-${ref}-auth-token`;
}

function decodeChunkedCookieValue(value: string): string | null {
  if (!value.startsWith(BASE64_PREFIX)) return value;

  try {
    const decoded = stringFromBase64URL(value.slice(BASE64_PREFIX.length));
    JSON.parse(decoded);
    return decoded;
  } catch {
    return null;
  }
}

async function readCookieJson(
  key: string,
  getAll: () => Array<{ name: string; value: string }>
): Promise<string | null> {
  const all = getAll();
  const chunked = await combineChunks(key, (chunkName) => {
    const match = all.find((c) => c.name === chunkName);
    return match?.value ?? null;
  });

  if (!chunked) return null;
  return decodeChunkedCookieValue(chunked);
}

function decodeJwtPayload(token: string): { sub?: string; email?: string } | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as {
      sub?: string;
      email?: string;
    };
  } catch {
    return null;
  }
}

function parseAuth(sessionJson: string | null, userJson: string | null): AuthFromCookies | null {
  let userId: string | undefined;
  let email: string | undefined;
  let accessToken: string | undefined;

  if (sessionJson) {
    try {
      const session = JSON.parse(sessionJson) as {
        access_token?: string;
        user?: { id?: string; email?: string };
      };
      accessToken = session.access_token;
      userId = session.user?.id;
      email = session.user?.email;

      if (!userId && accessToken) {
        const payload = decodeJwtPayload(accessToken);
        userId = payload?.sub;
        email = email ?? payload?.email;
      }
    } catch {
      // try user cookie below
    }
  }

  if (!userId && userJson) {
    try {
      const userData = JSON.parse(userJson) as { user?: { id?: string; email?: string } };
      userId = userData.user?.id;
      email = email ?? userData.user?.email;
    } catch {
      return null;
    }
  }

  if (!userId) return null;
  return { userId, email, accessToken };
}

async function readAuth(
  getAll: () => Array<{ name: string; value: string }>
): Promise<AuthFromCookies | null> {
  const key = storageKey();
  const [sessionJson, userJson] = await Promise.all([
    readCookieJson(key, getAll),
    readCookieJson(`${key}-user`, getAll),
  ]);
  return parseAuth(sessionJson, userJson);
}

/** Fast session read from Supabase auth cookies (no network). */
export async function getAuthFromCookies() {
  const store = await cookies();
  return readAuth(() => store.getAll());
}

export async function getAuthFromRequestCookies(
  getAll: () => Array<{ name: string; value: string }>
) {
  return readAuth(getAll);
}
