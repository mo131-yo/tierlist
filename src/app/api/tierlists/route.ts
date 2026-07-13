import { NextRequest, NextResponse } from "next/server";
import { listTierLists, createTierList } from "@/db/queries";

export async function GET() {
  const lists = await listTierLists();
  return NextResponse.json({ lists });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const row = await createTierList(
    typeof body.title === "string" ? body.title : undefined,
  );
  return NextResponse.json({ list: row }, { status: 201 });
}
