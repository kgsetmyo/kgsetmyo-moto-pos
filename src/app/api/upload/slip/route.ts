import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const profile = await requireProfile(["ADMIN", "CASHIER"]);
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${profile.id}/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const supabase = createAdminClient();
    const { error } = await supabase.storage.from("slips").upload(path, buffer, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });

    if (error) {
      if (error.message.includes("Bucket not found")) {
        return NextResponse.json(
          { error: "Storage bucket 'slips' not found. Run migration 003 in Supabase SQL Editor." },
          { status: 503 }
        );
      }
      throw error;
    }

    const { data: urlData } = supabase.storage.from("slips").getPublicUrl(path);
    return NextResponse.json({ url: urlData.publicUrl, path });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
