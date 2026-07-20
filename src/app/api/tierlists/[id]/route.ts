import { NextRequest, NextResponse } from "next/server";
import {
  getTierList,
  updateTierList,
  deleteTierList,
  getMediaByIds,
  type TierListData,
} from "@/db/queries";
import { normalizeTierListData } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const list = await getTierList(id);
  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = normalizeTierListData(JSON.parse(list.data));
  const allIds = [
    ...data.rows.flatMap((r) => r.itemIds),
    ...data.tray,
    ...data.watchLater,
  ];
  const items = await getMediaByIds(allIds);
  return NextResponse.json({ list, items });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = (await req.json()) as { title?: string; data?: TierListData };
  const updated = await updateTierList(id, body);
  if (!updated)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ list: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await deleteTierList(id);
  return NextResponse.json({ ok: true });
}
