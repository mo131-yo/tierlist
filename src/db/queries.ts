import { cache } from "react";
import { inArray, eq, desc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from ".";
import { mediaItems, searchCache, tierLists, type MediaItemRow } from "./schema";
import type { NormalizedMedia } from "@/lib/tmdb";
import {
  searchSource,
  browseSource,
  type BrowseOpts,
  type Category,
} from "@/lib/sources";
import { chunk, dedupeById } from "@/lib/batch";
import type { BrowseCat } from "@/lib/genres";
import type { MediaItem as MediaItemDto, TierRowData, TierListData } from "@/lib/types";

export type { MediaItemDto, TierRowData, TierListData };

/**
 * `db` эсвэл идэвхтэй transaction — bulk бичилтүүд хоёуланд ажиллана.
 * (drizzle-ийн tx нь db-тэй ижил query builder API-тай)
 */
type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

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

export type CacheStatus = "HIT" | "MISS" | "STALE";

/** Кэшийн мөрөөс item-уудыг эх дарааллаар нь ачаална (бүгд олдвол) */
async function loadCachedItems(ids: string[]): Promise<MediaItemDto[] | null> {
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(mediaItems)
    .where(inArray(mediaItems.id, ids));
  if (rows.length !== ids.length) return null;
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)!).map(rowToDto);
}

/**
 * Кэшийн бичилтийг ЦОГЦООР нь хийнэ: media_items мөрүүд + search_cache мөр
 * нэг transaction. Тусад нь бичвэл дундаас нь унасан үед search_cache нь
 * бүтэн id жагсаалт заасаар атал media_items дутуу үлдэж, `loadCachedItems`
 * үргэлж null буцаах → тухайн query мөнхийн MISS болно.
 * АНХААР: гадаад API дуудлага transaction-ы ГАДНА байна — удаан HTTP-ийн
 * турш pooler-ийн холболт (max: 5) барих ёсгүй.
 */
async function commitCache(
  items: NormalizedMedia[],
  cacheKey: string,
  cacheValue: unknown,
  now: number,
) {
  await db.transaction(async (tx) => {
    await upsertMediaItems(items, now, tx);
    await writeSearchCache(cacheKey, cacheValue, now, tx);
  });
}

/** MISS/refresh зам: эх сурвалжаас татаж media_items + search_cache-д бичнэ */
async function fetchAndCacheSearch(
  cat: Category,
  query: string,
  cacheKey: string,
): Promise<MediaItemDto[]> {
  const now = Date.now();
  const results = await searchSource(cat, query);
  await commitCache(results, cacheKey, results.map((r) => r.id), now);
  return results;
}

async function writeSearchCache(
  cacheKey: string,
  itemIds: unknown,
  now: number,
  exec: DbExecutor = db,
) {
  const json = JSON.stringify(itemIds);
  await exec
    .insert(searchCache)
    .values({ query: cacheKey, itemIds: json, createdAt: now })
    .onConflictDoUpdate({
      target: searchCache.query,
      set: { itemIds: json, createdAt: now },
    });
}

/**
 * Кэштэй хайлт (stale-while-revalidate): search_cache мөр байвал TTL хэтэрсэн
 * ч ШУУД буцаана — хэтэрсэн бол cache="STALE" тул route `after()`-оор
 * background refresh хийнэ. Жинхэнэ MISS л blocking гадаад API дуудна.
 * Cache key = `${cat}:${query}` — өөр category-ийн ижил query тусдаа кэшлэгдэнэ.
 */
export async function cachedSearch(
  cat: Category,
  rawQuery: string,
): Promise<{ items: MediaItemDto[]; cache: CacheStatus }> {
  const query = rawQuery.trim().toLowerCase();
  const cacheKey = `${cat}:${query}`;
  const now = Date.now();

  const cached = await db.query.searchCache.findFirst({
    where: eq(searchCache.query, cacheKey),
  });

  if (cached) {
    const ids = JSON.parse(cached.itemIds) as string[];
    const items = await loadCachedItems(ids);
    if (items) {
      const stale = now - cached.createdAt >= CACHE_TTL_MS[cat];
      return { items, cache: stale ? "STALE" : "HIT" };
    }
  }

  const results = await fetchAndCacheSearch(cat, query, cacheKey);
  return { items: results, cache: "MISS" };
}

// Нэг instance дотор ижил key-ийн зэрэгцээ background refresh-үүдийг нэгтгэнэ
const inFlightRefresh = new Set<string>();

/** STALE үед route-ийн after()-оос дуудагдана — хариуг хойшлуулахгүй */
export async function refreshSearch(cat: Category, rawQuery: string) {
  const query = rawQuery.trim().toLowerCase();
  const cacheKey = `${cat}:${query}`;
  if (inFlightRefresh.has(cacheKey)) return;
  inFlightRefresh.add(cacheKey);
  try {
    await fetchAndCacheSearch(cat, query, cacheKey);
    console.log(`[search] background refresh done: ${cacheKey}`);
  } catch (err) {
    console.error(`[search] background refresh failed: ${cacheKey}`, err);
  } finally {
    inFlightRefresh.delete(cacheKey);
  }
}

// ---- Browse (хайлтгүй үзэх) — search_cache хүснэгтээ дахин ашиглана ----
// browse: key-үүд {ids, hasMore} обьект хадгалдаг (зөвхөн эндээс уншигдана)

const BROWSE_TTL_MS = 1 * DAY;

function browseCacheKey(cat: BrowseCat, opts: BrowseOpts): string {
  // mode ЗААВАЛ орно — үгүй бол AND/OR хоёр бие биенийхээ кэшийг уншина
  const genres = [...opts.genreSlugs].sort().join(",");
  return `browse:${cat}:${opts.sort}:${opts.mode}:${genres}:${opts.page}`;
}

async function fetchAndCacheBrowse(
  cat: BrowseCat,
  opts: BrowseOpts,
  cacheKey: string,
): Promise<{ items: MediaItemDto[]; hasMore: boolean }> {
  const now = Date.now();
  const { items, hasMore } = await browseSource(cat, opts);
  await commitCache(
    items,
    cacheKey,
    { ids: items.map((i) => i.id), hasMore },
    now,
  );
  return { items, hasMore };
}

export async function cachedBrowse(
  cat: BrowseCat,
  opts: BrowseOpts,
): Promise<{ items: MediaItemDto[]; hasMore: boolean; cache: CacheStatus }> {
  const cacheKey = browseCacheKey(cat, opts);
  const now = Date.now();

  const cached = await db.query.searchCache.findFirst({
    where: eq(searchCache.query, cacheKey),
  });

  if (cached) {
    const val = JSON.parse(cached.itemIds) as { ids: string[]; hasMore: boolean };
    const items = await loadCachedItems(val.ids);
    if (items) {
      const stale = now - cached.createdAt >= BROWSE_TTL_MS;
      return { items, hasMore: val.hasMore, cache: stale ? "STALE" : "HIT" };
    }
  }

  const { items, hasMore } = await fetchAndCacheBrowse(cat, opts, cacheKey);
  return { items, hasMore, cache: "MISS" };
}

/** STALE үед browse route-ийн after()-оос дуудагдана */
export async function refreshBrowse(cat: BrowseCat, opts: BrowseOpts) {
  const cacheKey = browseCacheKey(cat, opts);
  if (inFlightRefresh.has(cacheKey)) return;
  inFlightRefresh.add(cacheKey);
  try {
    await fetchAndCacheBrowse(cat, opts, cacheKey);
    console.log(`[browse] background refresh done: ${cacheKey}`);
  } catch (err) {
    console.error(`[browse] background refresh failed: ${cacheKey}`, err);
  } finally {
    inFlightRefresh.delete(cacheKey);
  }
}

const UPSERT_CHUNK = 100;

async function upsertMediaItems(
  items: NormalizedMedia[],
  now: number,
  exec: DbExecutor = db,
) {
  // dedupeById заавал — нэг statement дотор ижил id давтагдвал Postgres
  // "ON CONFLICT DO UPDATE command cannot affect row a second time" шиднэ
  for (const part of chunk(dedupeById(items), UPSERT_CHUNK)) {
    await exec
      .insert(mediaItems)
      .values(
        part.map((item) => ({
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
        })),
      )
      .onConflictDoUpdate({
        target: mediaItems.id,
        set: {
          title: sql`excluded.title`,
          subtitle: sql`excluded.subtitle`,
          posterPath: sql`excluded.poster_path`,
          backdropPath: sql`excluded.backdrop_path`,
          overview: sql`excluded.overview`,
          genres: sql`excluded.genres`,
          year: sql`excluded.year`,
          rating: sql`excluded.rating`,
          popularity: sql`excluded.popularity`,
          refreshedAt: sql`excluded.refreshed_at`,
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
    data: JSON.stringify({
      rows: DEFAULT_ROWS,
      tray: [],
      watchLater: [],
    } satisfies TierListData),
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(tierLists).values(row);
  return row;
}

// React.cache — нэг request-ийн дотор generateMetadata + page component +
// opengraph-image хоёр/гурав хамтдаа дуудвал ганц л DB round-trip хийнэ
export const getTierList = cache(async (id: string) => {
  return db.query.tierLists.findFirst({ where: eq(tierLists.id, id) });
});

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
