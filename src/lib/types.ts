// Client + server хоёуланд хэрэглэгдэх shared type-ууд.
// (queries.ts серверийн db import-той тул client эндээс л импортолно)

export interface MediaItem {
  id: string;
  tmdbId: number;
  mediaType: string;
  title: string;
  subtitle: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string;
  genres: string[];
  year: string | null;
  rating: number;
  popularity: number;
}

export interface TierRowData {
  id: string;
  label: string;
  color: string;
  itemIds: string[];
}

export interface TierListData {
  rows: TierRowData[];
  tray: string[];
  watchLater: string[];
}

/**
 * DB-ийн хуучин blob-уудад watchLater талбар байхгүй тул parse хийсэн
 * бүх газар үүгээр normalize хийнэ — дараагийн autosave дээр талбар нь
 * өөрөө бичигдэнэ (migration хэрэггүй).
 */
export function normalizeTierListData(raw: unknown): TierListData {
  const d = (raw ?? {}) as Partial<TierListData>;
  return {
    rows: d.rows ?? [],
    tray: d.tray ?? [],
    watchLater: d.watchLater ?? [],
  };
}

export interface TierListMeta {
  id: string;
  title: string;
  data: string; // JSON.stringify(TierListData)
  createdAt: number;
  updatedAt: number;
}

export const CATEGORIES = [
  "all",
  "movie",
  "tv",
  "season",
  "anime",
  "manga",
  "character",
  "book",
  "wiki",
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Item-ийн id prefix → category (сервер TTL + client аль алинд) */
export function categoryOfItemId(id: string): Category {
  // custom- (өөрийн upload) item searchCache-д хэзээ ч ордоггүй тул
  // TTL-д нөлөөгүй; default movie гэж үзнэ
  if (id.startsWith("tv-")) return "tv";
  if (id.startsWith("season-")) return "season";
  if (id.startsWith("al-a-")) return "anime";
  if (id.startsWith("al-m-")) return "manga";
  if (id.startsWith("al-c-")) return "character";
  if (id.startsWith("book-")) return "book";
  if (id.startsWith("wiki-")) return "wiki";
  return "movie"; // movie-
}

/** Item-ийн id prefix → эх сурвалжийн нэр (DetailPanel-ийн rating badge) */
export function sourceOfItemId(id: string): string {
  if (id.startsWith("al-")) return "AniList";
  if (id.startsWith("book-")) return "Open Library";
  if (id.startsWith("wiki-")) return "Wikipedia";
  return "TMDB";
}

export const TIER_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#a3a3a3",
] as const;
