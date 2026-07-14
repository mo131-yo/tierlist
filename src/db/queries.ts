import { inArray, eq, desc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from ".";
import { mediaItems, searchCache, tierLists, type MediaItemRow } from "./schema";
import type { NormalizedMedia } from "@/lib/tmdb";
import {
  searchSource,
  categoryOfItemId,
  type Category,
} from "@/lib/sources";
import type { MediaItem as MediaItemDto, TierRowData, TierListData } from "@/lib/types";

export type { MediaItemDto, TierRowData, TierListData };

const DAY = 24 * 60 * 60 * 1000;

// Category бүрийн TTL — эх сурвалж бүрийн metadata хэр хурдан хуучирдагаас хамаарна
const CACHE_TTL_MS: Record<Category, number> = {
  all: 7 * DAY,
  movie: 7 * DAY, // rating/popularity долоо хоног тутам шинэчлэгдэнэ
  tv: 7 * DAY,
  season: 7 * DAY, // шинэ улирал нэмэгдэж болно
  anime: 30 * DAY, // AniList metadata бараг өөрчлөгддөггүй
  manga: 30 * DAY,
  character: 30 * DAY,
  book: 30 * DAY,
  wiki: 3 * DAY, // wiki контент илүү хурдан хуучирдаг
};

function rowToDto(r: MediaItemRow): MediaItemDto {
  return {
    id: r.id,
    tmdbId: r.tmdbId,
    mediaType: r.mediaType,
    title: r.title,
    subtitle: r.subtitle,
    posterPath: r.posterPath,
    backdropPath: r.backdropPath,
    overview: r.overview,
    genres: JSON.parse(r.genres) as string[],
    year: r.year,
    rating: r.rating,
    popularity: r.popularity,
  };
}

/**
 * Кэштэй хайлт: search_cache HIT + TTL шинэ бол гадаад API руу огт явахгүй.
 * TTL (category бүрд өөр) хэтэрсэн эсвэл MISS бол эх сурвалжаас татаж upsert хийнэ.
 * Cache key = `${cat}:${query}` — өөр category-ийн ижил query тусдаа кэшлэгдэнэ.
 */
export async function cachedSearch(
  cat: Category,
  rawQuery: string,
): Promise<{ items: MediaItemDto[]; cache: "HIT" | "MISS" }> {
  const query = rawQuery.trim().toLowerCase();
  const cacheKey = `${cat}:${query}`;
  const ttl = CACHE_TTL_MS[cat];
  const now = Date.now();

  const cached = await db.query.searchCache.findFirst({
    where: eq(searchCache.query, cacheKey),
  });

  if (cached && now - cached.createdAt < ttl) {
    const ids = JSON.parse(cached.itemIds) as string[];
    if (ids.length === 0) return { items: [], cache: "HIT" };
    const rows = await db
      .select()
      .from(mediaItems)
      .where(inArray(mediaItems.id, ids));
    const fresh = rows.every(
      (r) => now - r.refreshedAt < CACHE_TTL_MS[categoryOfItemId(r.id)],
    );
    if (fresh && rows.length === ids.length) {
      const byId = new Map(rows.map((r) => [r.id, r]));
      return {
        items: ids.map((id) => byId.get(id)!).filter(Boolean).map(rowToDto),
        cache: "HIT",
      };
    }
  }

  // MISS (эсвэл TTL хэтэрсэн) — эх сурвалжаас татаж upsert
  const results = await searchSource(cat, query);
  await upsertMediaItems(results, now);
  await db
    .insert(searchCache)
    .values({
      query: cacheKey,
      itemIds: JSON.stringify(results.map((r) => r.id)),
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: searchCache.query,
      set: {
        itemIds: JSON.stringify(results.map((r) => r.id)),
        createdAt: now,
      },
    });

  return { items: results, cache: "MISS" };
}

async function upsertMediaItems(items: NormalizedMedia[], now: number) {
  for (const item of items) {
    await db
      .insert(mediaItems)
      .values({
        id: item.id,
        tmdbId: item.tmdbId,
        mediaType: item.mediaType,
        title: item.title,
        subtitle: item.subtitle,
        posterPath: item.posterPath,
        backdropPath: item.backdropPath,
        overview: item.overview,
        genres: JSON.stringify(item.genres),
        year: item.year,
        rating: item.rating,
        popularity: item.popularity,
        refreshedAt: now,
      })
      .onConflictDoUpdate({
        target: mediaItems.id,
        set: {
          title: item.title,
          subtitle: item.subtitle,
          posterPath: item.posterPath,
          backdropPath: item.backdropPath,
          overview: item.overview,
          genres: JSON.stringify(item.genres),
          year: item.year,
          rating: item.rating,
          popularity: item.popularity,
          refreshedAt: now,
        },
      });
  }
}

/**
 * Нүүрний marquee: төрөл бүрээс (кино/сериал/аниме/манга/улирал) хамгийн
 * алдартай item-уудыг БҮТЭН мэдээлэлтэй нь (нэр, тайлбар, genre...) авч
 * interleave хийж буцаана — дарахад QuickView гарна.
 */
export async function getMarqueeItems(): Promise<MediaItemDto[]> {
  // НЭГ query (window function) — parallel query burst нь Supabase transaction
  // pooler дээр гацдаг байсан тул төрөл бүрийн топыг нэг statement-ээр авна
  const rows = (await db.execute(sql`
    select id, tmdb_id, media_type, title, subtitle, poster_path, backdrop_path,
           overview, genres, year, rating, popularity, refreshed_at
    from (
      select m.*, row_number() over (partition by media_type order by popularity desc) as rn
      from media_items m
      where poster_path is not null
        and media_type in ('movie','tv','anime','manga','season')
    ) t
    where rn <= 20
    order by media_type, rn
  `)) as unknown as Array<Record<string, unknown>>;

  const caps: Record<string, number> = {
    movie: 20,
    tv: 20,
    anime: 20,
    manga: 15,
    season: 10,
  };
  const byType = new Map<string, MediaItemDto[]>();
  for (const r of rows) {
    const type = r.media_type as string;
    const list = byType.get(type) ?? [];
    if (list.length >= (caps[type] ?? 0)) continue;
    list.push({
      id: r.id as string,
      tmdbId: Number(r.tmdb_id),
      mediaType: type,
      title: r.title as string,
      subtitle: (r.subtitle as string | null) ?? null,
      posterPath: r.poster_path as string | null,
      backdropPath: r.backdrop_path as string | null,
      overview: (r.overview as string) ?? "",
      genres: JSON.parse((r.genres as string) || "[]") as string[],
      year: (r.year as string | null) ?? null,
      rating: Number(r.rating) || 0,
      popularity: Number(r.popularity) || 0,
    });
    byType.set(type, list);
  }
  const lists = [...byType.values()];
  const out: MediaItemDto[] = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) {
    for (const l of lists) {
      if (i < l.length) out.push(l[i]);
    }
  }
  return out;
}

export async function getMediaByIds(ids: string[]): Promise<MediaItemDto[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(mediaItems)
    .where(inArray(mediaItems.id, ids));
  return rows.map(rowToDto);
}

// ---- Tier lists ----

const DEFAULT_ROWS: TierRowData[] = [
  { id: "s", label: "S", color: "#ef4444", itemIds: [] },
  { id: "a", label: "A", color: "#f97316", itemIds: [] },
  { id: "b", label: "B", color: "#eab308", itemIds: [] },
  { id: "c", label: "C", color: "#22c55e", itemIds: [] },
  { id: "d", label: "D", color: "#3b82f6", itemIds: [] },
];

export async function listTierLists() {
  return db.select().from(tierLists).orderBy(desc(tierLists.updatedAt));
}

export async function createTierList(title?: string) {
  const now = Date.now();
  const row = {
    id: nanoid(10),
    title: title ?? "Шинэ Tier List",
    data: JSON.stringify({ rows: DEFAULT_ROWS, tray: [] } satisfies TierListData),
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(tierLists).values(row);
  return row;
}

export async function getTierList(id: string) {
  return db.query.tierLists.findFirst({ where: eq(tierLists.id, id) });
}

export async function updateTierList(
  id: string,
  patch: { title?: string; data?: TierListData },
) {
  const set: Record<string, unknown> = { updatedAt: Date.now() };
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.data !== undefined) set.data = JSON.stringify(patch.data);
  await db.update(tierLists).set(set).where(eq(tierLists.id, id));
  return getTierList(id);
}

export async function deleteTierList(id: string) {
  await db.delete(tierLists).where(eq(tierLists.id, id));
}
