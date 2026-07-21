import {
  searchTmdbMovies,
  searchTmdbTv,
  searchTvSeasons,
  discoverTmdb,
  type NormalizedMedia,
} from "@/lib/tmdb";
import {
  searchAnilistAnime,
  searchAnilistManga,
  searchAnilistCharacters,
  searchAnilistTvSeasons,
  searchAnilistAnimeLight,
  searchAnilistMangaLight,
  searchAnilistCharactersLight,
  browseAnilist,
} from "./anilist";
import { searchOpenLibrary } from "./openlibrary";
import { searchWikipedia } from "./wikipedia";
import { CATEGORIES, type Category } from "@/lib/types";
import { interleave } from "@/lib/batch";
import {
  BROWSE_CATS,
  BROWSE_GENRES,
  type BrowseCat,
  type BrowseSort,
  type GenreMode,
} from "@/lib/genres";

export { RateLimitError } from "./anilist";
export { categoryOfItemId, sourceOfItemId, CATEGORIES } from "@/lib/types";
export type { Category };

export function isCategory(v: string | null): v is Category {
  return !!v && (CATEGORIES as readonly string[]).includes(v);
}

export function isBrowseCategory(v: string | null): v is BrowseCat {
  return !!v && (BROWSE_CATS as readonly string[]).includes(v);
}

/**
 * Browse горим: хайлтгүйгээр тухайн category-ийн алдартай/шинэ контентыг
 * genre-ээр шүүж хуудаслана. slug → TMDB id / AniList нэр энд хөрвөнө.
 */
export interface BrowseOpts {
  genreSlugs: string[];
  sort: BrowseSort;
  page: number;
  /** Олон genre сонгосон үед: бүгд таарах (and) эсвэл аль нэг (or) */
  mode: GenreMode;
}

export async function browseSource(
  cat: BrowseCat,
  opts: BrowseOpts,
): Promise<{ items: NormalizedMedia[]; hasMore: boolean }> {
  const defs = BROWSE_GENRES[cat].filter((g) => opts.genreSlugs.includes(g.slug));
  switch (cat) {
    case "movie":
    case "tv":
      return discoverTmdb(cat, {
        genreIds: defs.map((g) => g.tmdbId!).filter(Boolean),
        sort: opts.sort,
        page: opts.page,
        mode: opts.mode,
      });
    case "anime":
    case "manga":
      return browseAnilist(cat === "anime" ? "ANIME" : "MANGA", {
        genres: defs.map((g) => g.anilist!).filter(Boolean),
        sort: opts.sort,
        page: opts.page,
        mode: opts.mode,
      });
  }
}

/**
 * Улирлын hybrid хайлт: TMDB-ийн улирлууд + AniList-ийн аниме цувралууд.
 * TMDB зарим анимегийн улирлуудыг нэгтгэдэг (ж: Blue Lock S1+S2 → "Season 1")
 * бол AniList улирал бүрийг тусдаа бүртгэлээр өгдөг. Аниме биш query-д
 * AniList юу ч буцаахгүй тул нөлөөгүй.
 */
async function searchSeasons(query: string): Promise<NormalizedMedia[]> {
  const [tmdb, anilist] = await Promise.allSettled([
    searchTvSeasons(query),
    searchAnilistTvSeasons(query),
  ]);
  return [
    ...(tmdb.status === "fulfilled" ? tmdb.value : []),
    ...(anilist.status === "fulfilled" ? anilist.value : []),
  ];
}

/** Удаан source нэг хайлтыг бүхэлд нь чирэхээс сэргийлнэ */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error("source timeout")), ms),
    ),
  ]);
}

const ALL_SOURCE_TIMEOUT_MS = 3000;

/**
 * «Бүгд» таб: season-оос бусад бүх source-ийг зэрэг хайна.
 * Нэг source унасан/удаасан ч бусад нь хэвээр гарна — хариу нь хамгийн
 * удаан source биш, timeout-ийн хязгаараар баригдана. (Timeout болсон
 * source тухайн query-ийн кэшэнд орохгүй үлдэж болно — хурдны tradeoff.)
 */
async function searchAll(query: string): Promise<NormalizedMedia[]> {
  // AniList-ийн хөнгөн хувилбаруудыг ашиглана (studio/roster-гүй) —
  // нэг «Бүгд» хайлт AniList-руу 3 л request явуулж rate limit хэмнэнэ
  const settled = await Promise.allSettled([
    withTimeout(searchTmdbMovies(query), ALL_SOURCE_TIMEOUT_MS),
    withTimeout(searchTmdbTv(query), ALL_SOURCE_TIMEOUT_MS),
    withTimeout(searchAnilistAnimeLight(query), ALL_SOURCE_TIMEOUT_MS),
    withTimeout(searchAnilistMangaLight(query), ALL_SOURCE_TIMEOUT_MS),
    withTimeout(searchAnilistCharactersLight(query), ALL_SOURCE_TIMEOUT_MS),
    withTimeout(searchOpenLibrary(query, 20), ALL_SOURCE_TIMEOUT_MS),
    withTimeout(searchWikipedia(query, 20), ALL_SOURCE_TIMEOUT_MS),
  ]);
  const lists = settled.map((s) => (s.status === "fulfilled" ? s.value : []));
  return interleave(lists);
}

export async function searchSource(
  cat: Category,
  query: string,
): Promise<NormalizedMedia[]> {
  switch (cat) {
    case "all":
      return searchAll(query);
    case "movie":
      return searchTmdbMovies(query);
    case "tv":
      return searchTmdbTv(query);
    case "season":
      return searchSeasons(query);
    case "anime":
      return searchAnilistAnime(query);
    case "manga":
      return searchAnilistManga(query);
    case "character":
      return searchAnilistCharacters(query);
    case "book":
      return searchOpenLibrary(query);
    case "wiki":
      return searchWikipedia(query);
  }
}
