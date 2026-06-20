import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { importProductsFromCsv } from "@/lib/data/product-import";
import { PRODUCT_IMPORT_TEMPLATE } from "@/lib/csv";

export async function GET() {
  try {
    await requireProfile(["ADMIN"]);
    return new NextResponse(PRODUCT_IMPORT_TEMPLATE, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="product-import-template.csv"',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireProfile(["ADMIN"]);

    const contentType = request.headers.get("content-type") ?? "";
    let csvText: string;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: "CSV file required" }, { status: 400 });
      }
      csvText = await file.text();
    } else {
      const body = (await request.json()) as { csv?: string };
      if (!body.csv?.trim()) {
        return NextResponse.json({ error: "csv field required" }, { status: 400 });
      }
      csvText = body.csv;
    }

    const result = await importProductsFromCsv(csvText);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
