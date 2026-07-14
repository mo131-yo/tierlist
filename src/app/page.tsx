import {
  listTierLists,
  getMediaByIds,
  getMarqueeItems,
  type TierListData,
} from "@/db/queries";
import { HomeClient, type HomeListItem } from "@/components/home/HomeClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Дараалсан query-нүүд — parallel burst Supabase transaction pooler дээр
  // гацдаг байсан (нэг query ч хурдан тул нийт ~1s дотор багтана)
  const lists = await listTierLists();
  const marqueeItems = await getMarqueeItems();

  // Бүх list-ийн preview зургуудыг НЭГ query-ээр авна
  const parsed = lists.map((l) => {
    const data = JSON.parse(l.data) as TierListData;
    return {
      l,
      data,
      previewIds: [...data.rows.flatMap((r) => r.itemIds), ...data.tray].slice(
        0,
        6,
      ),
    };
  });
  const allPreviewItems = await getMediaByIds(
    [...new Set(parsed.flatMap((p) => p.previewIds))],
  );
  const posterById = new Map(allPreviewItems.map((i) => [i.id, i.posterPath]));

  const homeLists: HomeListItem[] = parsed.map(({ l, data, previewIds }) => ({
    id: l.id,
    title: l.title,
    updatedAt: l.updatedAt,
    itemCount:
      data.rows.reduce((n, r) => n + r.itemIds.length, 0) + data.tray.length,
    posters: previewIds
      .map((id) => posterById.get(id))
      .filter((p): p is string => Boolean(p)),
  }));

  return <HomeClient lists={homeLists} marqueeItems={marqueeItems} />;
}
