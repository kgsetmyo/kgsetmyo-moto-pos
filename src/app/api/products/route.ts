import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { apiError } from "@/lib/api/route-errors";
import { createProduct } from "@/lib/data/products-admin";
import { searchProducts } from "@/lib/data/products";
import { productSchema } from "@/lib/schemas/product";
import { getPaginationParams, toPaginated } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    await requireProfile();
    const { searchParams } = request.nextUrl;
    const { page, pageSize } = getPaginationParams(searchParams);

    const { data, total } = await searchProducts({
      q: searchParams.get("q")?.trim(),
      bikeBrand: searchParams.get("bikeBrand") ?? undefined,
      bikeModel: searchParams.get("bikeModel") ?? undefined,
      year: searchParams.get("year") ?? undefined,
      page,
      pageSize,
    });

    return NextResponse.json(toPaginated(data, total, page, pageSize));
  } catch (error) {
    return apiError(error, { fallback: "Search failed" });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireProfile(["ADMIN"]);
    const body = productSchema.parse(await request.json());

    if (!body.brandId && !body.brandName) {
      return NextResponse.json({ error: "Brand required" }, { status: 400 });
    }
    if (!body.categoryId && !body.categoryName) {
      return NextResponse.json({ error: "Category required" }, { status: 400 });
    }

    const product = await createProduct(body);
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    return apiError(error, { fallback: "Failed" });
  }
}
