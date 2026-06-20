import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { apiError } from "@/lib/api/route-errors";
import { getBusinessDateString } from "@/lib/business-date";
import { closeBusinessDay, getDailyCloseStatus } from "@/lib/data/daily-close";
import { generateZReportSupabase, getSalesReportSupabase } from "@/lib/data/reports";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const type = searchParams.get("type") ?? "range";
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const date = searchParams.get("date");

    if (type === "day-status") {
      await requireProfile(["ADMIN", "CASHIER"]);
      const businessDate = date ?? getBusinessDateString();
      const status = await getDailyCloseStatus(businessDate);
      return NextResponse.json(status);
    }

    await requireProfile(["ADMIN"]);

    if (type === "z-report" && date) {
      const report = await generateZReportSupabase(date);
      const closeStatus = await getDailyCloseStatus(date);
      return NextResponse.json({ ...report, closed: closeStatus.closed, closeRecord: closeStatus.record });
    }

    if (from && to) {
      const report = await getSalesReportSupabase(from, to);
      return NextResponse.json(report);
    }

    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  } catch (error) {
    return apiError(error, { fallback: "Report failed" });
  }
}

const closeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const profile = await requireProfile(["ADMIN"]);
    const body = closeSchema.parse(await request.json());
    const record = await closeBusinessDay({
      businessDate: body.date,
      closedById: profile.id,
      notes: body.notes,
    });
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Close failed";
    const status = message.includes("already closed") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
