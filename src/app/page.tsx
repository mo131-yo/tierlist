import {
  listTierLists,
  getMediaByIds,
  getPopularPosters,
  type TierListData,
} from "@/db/queries";
import { HomeClient, type HomeListItem } from "@/components/home/HomeClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [lists, marqueePosters] = await Promise.all([
    listTierLists(),
    getPopularPosters(30),
  ]);

  const homeLists: HomeListItem[] = await Promise.all(
    lists.map(async (l) => {
      const data = JSON.parse(l.data) as TierListData;
      const previewIds = [
        ...data.rows.flatMap((r) => r.itemIds),
        ...data.tray,
      ].slice(0, 6);
      const previewItems = await getMediaByIds(previewIds);
      return {
        id: l.id,
        title: l.title,
        updatedAt: l.updatedAt,
        itemCount:
          data.rows.reduce((n, r) => n + r.itemIds.length, 0) + data.tray.length,
        posters: previewItems
          .map((i) => i.posterPath)
          .filter((p): p is string => Boolean(p)),
      };
    }),
  );

  return <HomeClient lists={homeLists} marqueePosters={marqueePosters} />;
}
