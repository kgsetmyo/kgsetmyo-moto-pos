import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { apiError } from "@/lib/api/route-errors";
import { createSaleWithFifo, listSales } from "@/lib/data/sales";
import { getPaginationParams } from "@/lib/utils";

const saleSchema = z
  .object({
    customerId: z.string().uuid().optional(),
    discount: z.number().min(0).optional(),
    notes: z.string().optional(),
    lines: z
      .array(
        z.object({
          productId: z.string().uuid(),
          quantity: z.number().int().positive(),
          unitPrice: z.number().positive(),
        })
      )
      .min(1),
    payments: z
      .array(
        z.object({
          method: z.enum(["CASH", "MOBILE_BANKING", "CREDIT"]),
          amount: z.number().positive(),
          slipUrl: z.string().url().optional(),
          reference: z.string().optional(),
        })
      )
      .min(1),
  })
  .superRefine((data, ctx) => {
    const subtotal = data.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const total = subtotal - (data.discount ?? 0);
    const paid = data.payments.reduce((s, p) => s + p.amount, 0);
    if (Math.abs(paid - total) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Payment total (${paid}) must equal sale total (${total})`,
        path: ["payments"],
      });
    }
    if (data.payments.some((p) => p.method === "CREDIT") && !data.customerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Customer required for credit payments",
        path: ["customerId"],
      });
    }
    for (const [i, p] of data.payments.entries()) {
      if (p.method === "MOBILE_BANKING" && !p.slipUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Slip required for mobile banking payments",
          path: ["payments", i, "slipUrl"],
        });
      }
    }
  });

export async function GET(request: NextRequest) {
  try {
    await requireProfile(["ADMIN", "CASHIER"]);
    const { searchParams } = request.nextUrl;
    const { page, pageSize } = getPaginationParams(searchParams);
    const q = searchParams.get("q") ?? undefined;
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;

    const result = await listSales({ q, from, to, page, pageSize });
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error, { fallback: "Failed to load sales" });
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await requireProfile(["ADMIN", "CASHIER"]);
    const body = saleSchema.parse(await request.json());

    const sale = await createSaleWithFifo({
      ...body,
      cashierId: profile.id,
    });

    return NextResponse.json(sale, { status: 201 });
  } catch (error) {
    return apiError(error, { fallback: "Sale failed" });
  }
}
