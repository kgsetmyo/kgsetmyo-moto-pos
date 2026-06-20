import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { apiError } from "@/lib/api/route-errors";
import { createExpense, listExpenses } from "@/lib/data/expenses";

const expenseSchema = z.object({
  category: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().positive(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(request: NextRequest) {
  try {
    await requireProfile(["ADMIN"]);
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");
    if (!from || !to) {
      return NextResponse.json({ error: "from and to required" }, { status: 400 });
    }
    const expenses = await listExpenses(from, to);
    return NextResponse.json(expenses);
  } catch (error) {
    return apiError(error, { fallback: "Failed" });
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await requireProfile(["ADMIN"]);
    const body = expenseSchema.parse(await request.json());
    const expense = await createExpense({
      ...body,
      recordedById: profile.id,
    });
    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed";
    const status = message.includes("closed") ? 423 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
