import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTierList, getMediaByIds } from "@/db/queries";
import { normalizeTierListData } from "@/lib/types";
import { TierBoard } from "@/components/tier/TierBoard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const list = await getTierList(id);
  if (!list) return {};
  // og:image-ийн <meta> tag-ийг Next өөрөө opengraph-image.tsx-ээс нэмнэ —
  // энд зөвхөн гарчиг/тайлбарыг тохируулна
  return {
    title: `${list.title} — CineTier`,
    description: `${list.title} tier list — CineTier дээр үзэх`,
    openGraph: { title: list.title, type: "website" },
  };
}

export default async function TierListPage({ params }: Params) {
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
