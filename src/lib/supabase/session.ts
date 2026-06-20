import { cookies } from "next/headers";
import { combineChunks, stringFromBase64URL } from "@supabase/ssr";
import { validateAccessToken } from "@/lib/supabase/jwt";
import { NextResponse, type NextRequest } from "next/server";

const BASE64_PREFIX = "base64-";

export type AuthFromCookies = {
  userId: string;
  email?: string;
  accessToken?: string;
};

export function authStorageKey() {
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

async function parseAuth(sessionJson: string | null): Promise<AuthFromCookies | null> {
  if (!sessionJson) return null;

  let accessToken: string | undefined;
  let userId: string | undefined;
  let email: string | undefined;

  try {
    const session = JSON.parse(sessionJson) as {
      access_token?: string;
      user?: { id?: string; email?: string };
    };
    accessToken = session.access_token;
    userId = session.user?.id;
    email = session.user?.email;
  } catch {
    return null;
  }

  if (!accessToken) return null;

  const payload = await validateAccessToken(accessToken);
  if (!payload) return null;

  userId = payload.sub ?? userId;
  email = email ?? payload.email;

  if (!userId) return null;
  return { userId, email, accessToken };
}

async function readAuth(
  getAll: () => Array<{ name: string; value: string }>
): Promise<AuthFromCookies | null> {
  const key = authStorageKey();
  const sessionJson = await readCookieJson(key, getAll);
  return parseAuth(sessionJson);
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

/** Clear Supabase auth cookies from a proxy response (invalid/expired session). */
export function clearAuthCookies(request: NextRequest, response: NextResponse) {
  const key = authStorageKey();
  const names = new Set<string>();

  for (const cookie of request.cookies.getAll()) {
    const name = cookie.name;
    if (
      name === key ||
      name.startsWith(`${key}.`) ||
      name === `${key}-user` ||
      name.startsWith(`${key}-user.`)
    ) {
      names.add(name);
    }
  }

  for (const name of names) {
    response.cookies.delete(name);
  }
}
