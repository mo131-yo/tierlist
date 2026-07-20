import { notFound } from "next/navigation";
import { getTierList, getMediaByIds } from "@/db/queries";
import { normalizeTierListData } from "@/lib/types";
import { TierBoard } from "@/components/tier/TierBoard";

export const dynamic = "force-dynamic";

export default async function TierListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const list = await getTierList(id);
  if (!list) notFound();

  const data = normalizeTierListData(JSON.parse(list.data));
  const allIds = [
    ...data.rows.flatMap((r) => r.itemIds),
    ...data.tray,
    ...data.watchLater,
  ];
  const items = await getMediaByIds(allIds);

  return <TierBoard list={list} initialItems={items} />;
}
