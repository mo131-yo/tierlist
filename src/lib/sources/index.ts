import {
  searchTmdbMovies,
  searchTmdbTv,
  searchTvSeasons,
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
} from "./anilist";
import { searchOpenLibrary } from "./openlibrary";
import { searchWikipedia } from "./wikipedia";
import { CATEGORIES, type Category } from "@/lib/types";

export { RateLimitError } from "./anilist";
export { categoryOfItemId, sourceOfItemId, CATEGORIES } from "@/lib/types";
export type { Category };

export function isCategory(v: string | null): v is Category {
  return !!v && (CATEGORIES as readonly string[]).includes(v);
}

/** Хэд хэдэн source-ийн үр дүнг ээлжлэн (round-robin) хольж нэгтгэнэ */
function interleave(lists: NormalizedMedia[][]): NormalizedMedia[] {
  const out: NormalizedMedia[] = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) {
    for (const list of lists) {
      if (i < list.length) out.push(list[i]);
    }
  }
  return out;
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

/**
 * «Бүгд» таб: season-оос бусад бүх source-ийг зэрэг хайна.
 * Нэг source унасан ч (ж: AniList 429) бусад нь хэвээр гарна.
 */
async function searchAll(query: string): Promise<NormalizedMedia[]> {
  // AniList-ийн хөнгөн хувилбаруудыг ашиглана (studio/roster-гүй) —
  // нэг «Бүгд» хайлт AniList-руу 3 л request явуулж rate limit хэмнэнэ
  const settled = await Promise.allSettled([
    searchTmdbMovies(query),
    searchTmdbTv(query),
    searchAnilistAnimeLight(query),
    searchAnilistMangaLight(query),
    searchAnilistCharactersLight(query),
    searchOpenLibrary(query),
    searchWikipedia(query),
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
