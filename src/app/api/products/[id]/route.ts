import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { apiError } from "@/lib/api/route-errors";
import { getProduct, updateProduct, deactivateProduct } from "@/lib/data/products-admin";
import { updateProductSchema } from "@/lib/schemas/product";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireProfile();
    const { id } = await params;
    const product = await getProduct(id);
    return NextResponse.json(product);
  } catch (error) {
    return apiError(error, { fallback: "Not found" });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireProfile(["ADMIN"]);
    const { id } = await params;
    const body = updateProductSchema.parse(await request.json());
    const product = await updateProduct(id, body);
    return NextResponse.json(product);
  } catch (error) {
    return apiError(error, { fallback: "Failed" });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireProfile(["ADMIN"]);
    const { id } = await params;
    const result = await deactivateProduct(id);
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error, { fallback: "Failed" });
  }
}
