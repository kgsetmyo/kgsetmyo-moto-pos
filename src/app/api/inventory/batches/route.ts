import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { apiError } from "@/lib/api/route-errors";
import { listBatchesForProduct } from "@/lib/data/inventory";
import { receiveStockBatch } from "@/lib/data/sales";

const batchSchema = z.object({
  productId: z.string().uuid(),
  costPrice: z.number().positive(),
  sellingPrice: z.number().positive(),
  quantity: z.number().int().positive(),
  batchNumber: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const profile = await requireProfile(["ADMIN", "CASHIER"]);
    const productId = request.nextUrl.searchParams.get("productId");
    if (!productId) {
      return NextResponse.json({ error: "productId required" }, { status: 400 });
    }

    const includeCosts = profile.role === "ADMIN";
    const batches = await listBatchesForProduct(productId, { includeCosts });
    return NextResponse.json({ data: batches });
  } catch (error) {
    return apiError(error, { fallback: "Failed to load batches" });
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await requireProfile(["ADMIN"]);
    const body = batchSchema.parse(await request.json());

    const batch = await receiveStockBatch({
      productId: body.productId,
      costPrice: body.costPrice,
      sellingPrice: body.sellingPrice,
      quantity: body.quantity,
      batchNumber: body.batchNumber,
      notes: body.notes,
      createdById: profile.id,
    });

    return NextResponse.json(batch, { status: 201 });
  } catch (error) {
    return apiError(error, { fallback: "Failed to receive stock" });
  }
}
