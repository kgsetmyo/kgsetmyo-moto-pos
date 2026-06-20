import { NextResponse } from "next/server";
import { z } from "zod";

export function apiError(
  error: unknown,
  options?: { fallback?: string; statusMap?: Record<string, number> }
) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: error.flatten() }, { status: 400 });
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof (error as { message: unknown }).message === "string"
        ? (error as { message: string }).message
        : options?.fallback ?? "Request failed";
  const status =
    options?.statusMap?.[message] ??
    Object.entries(options?.statusMap ?? {}).find(([key]) => message.includes(key))?.[1] ??
    (message === "Unauthorized"
      ? 401
      : message === "Forbidden"
        ? 403
        : message.includes("Insufficient stock")
          ? 409
          : message.includes("Credit limit exceeded")
            ? 409
            : message.includes("already closed")
              ? 423
              : message.includes("Checkout function")
                ? 503
                : 500);

  return NextResponse.json({ error: message }, { status });
}
