import { notFound } from "next/navigation";
import { getTierList, getMediaByIds, type TierListData } from "@/db/queries";
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

  const data = JSON.parse(list.data) as TierListData;
  const allIds = [...data.rows.flatMap((r) => r.itemIds), ...data.tray];
  const items = await getMediaByIds(allIds);

  return <TierBoard list={list} initialItems={items} />;
}
