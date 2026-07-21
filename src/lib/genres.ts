// Browse горимын нэгдсэн genre жагсаалт (client + server хоёуланд).
// slug нь URL/cache key-ийн валют; сервер slug → tmdbId (movie/tv) эсвэл
// anilist нэр (anime/manga) болгож хөрвүүлнэ. Genre нэрс API-аас ирдэг тул
// англиар үлдэнэ.

export type BrowseCat = "movie" | "tv" | "anime" | "manga";
export type BrowseSort = "popularity" | "rating" | "newest";
/** Олон genre сонгосон үеийн логик: "and" = бүгд таарна, "or" = аль нэг нь */
export type GenreMode = "and" | "or";

export const BROWSE_CATS = ["movie", "tv", "anime", "manga"] as const;
export const BROWSE_SORTS = ["popularity", "rating", "newest"] as const;
export const GENRE_MODES = ["and", "or"] as const;

export interface GenreDef {
  slug: string;
  label: string;
  tmdbId?: number; // movie/tv — TMDB discover-ийн with_genres
  anilist?: string; // anime/manga — AniList genre_in-ийн яг нэр
}

const MOVIE_GENRES: GenreDef[] = [
  { slug: "action", label: "Action", tmdbId: 28 },
  { slug: "adventure", label: "Adventure", tmdbId: 12 },
  { slug: "animation", label: "Animation", tmdbId: 16 },
  { slug: "comedy", label: "Comedy", tmdbId: 35 },
  { slug: "crime", label: "Crime", tmdbId: 80 },
  { slug: "documentary", label: "Documentary", tmdbId: 99 },
  { slug: "drama", label: "Drama", tmdbId: 18 },
  { slug: "family", label: "Family", tmdbId: 10751 },
  { slug: "fantasy", label: "Fantasy", tmdbId: 14 },
  { slug: "history", label: "History", tmdbId: 36 },
  { slug: "horror", label: "Horror", tmdbId: 27 },
  { slug: "music", label: "Music", tmdbId: 10402 },
  { slug: "mystery", label: "Mystery", tmdbId: 9648 },
  { slug: "romance", label: "Romance", tmdbId: 10749 },
  { slug: "science-fiction", label: "Science Fiction", tmdbId: 878 },
  { slug: "thriller", label: "Thriller", tmdbId: 53 },
  { slug: "war", label: "War", tmdbId: 10752 },
  { slug: "western", label: "Western", tmdbId: 37 },
];

const TV_GENRES: GenreDef[] = [
  { slug: "action-adventure", label: "Action & Adventure", tmdbId: 10759 },
  { slug: "animation", label: "Animation", tmdbId: 16 },
  { slug: "comedy", label: "Comedy", tmdbId: 35 },
  { slug: "crime", label: "Crime", tmdbId: 80 },
  { slug: "documentary", label: "Documentary", tmdbId: 99 },
  { slug: "drama", label: "Drama", tmdbId: 18 },
  { slug: "family", label: "Family", tmdbId: 10751 },
  { slug: "kids", label: "Kids", tmdbId: 10762 },
  { slug: "mystery", label: "Mystery", tmdbId: 9648 },
  { slug: "reality", label: "Reality", tmdbId: 10764 },
  { slug: "sci-fi-fantasy", label: "Sci-Fi & Fantasy", tmdbId: 10765 },
  { slug: "soap", label: "Soap", tmdbId: 10766 },
  { slug: "war-politics", label: "War & Politics", tmdbId: 10768 },
  { slug: "western", label: "Western", tmdbId: 37 },
];

// AniList-ийн албан ёсны genre жагсаалт (anime/manga хоёуланд ижил)
const ANILIST_GENRES: GenreDef[] = [
  { slug: "action", label: "Action", anilist: "Action" },
  { slug: "adventure", label: "Adventure", anilist: "Adventure" },
  { slug: "comedy", label: "Comedy", anilist: "Comedy" },
  { slug: "drama", label: "Drama", anilist: "Drama" },
  { slug: "fantasy", label: "Fantasy", anilist: "Fantasy" },
  { slug: "horror", label: "Horror", anilist: "Horror" },
  { slug: "mahou-shoujo", label: "Mahou Shoujo", anilist: "Mahou Shoujo" },
  { slug: "mecha", label: "Mecha", anilist: "Mecha" },
  { slug: "music", label: "Music", anilist: "Music" },
  { slug: "mystery", label: "Mystery", anilist: "Mystery" },
  { slug: "psychological", label: "Psychological", anilist: "Psychological" },
  { slug: "romance", label: "Romance", anilist: "Romance" },
  { slug: "sci-fi", label: "Sci-Fi", anilist: "Sci-Fi" },
  { slug: "slice-of-life", label: "Slice of Life", anilist: "Slice of Life" },
  { slug: "sports", label: "Sports", anilist: "Sports" },
  { slug: "supernatural", label: "Supernatural", anilist: "Supernatural" },
  { slug: "thriller", label: "Thriller", anilist: "Thriller" },
];

export const BROWSE_GENRES: Record<BrowseCat, GenreDef[]> = {
  movie: MOVIE_GENRES,
  tv: TV_GENRES,
  anime: ANILIST_GENRES,
  manga: ANILIST_GENRES,
};

/**
 * Текст хайлтын үед genre chip-ийн client-side шүүлт: item-ийн genres
 * metadata (TMDB нэр эсвэл AniList нэр) chip-тэй таарч байвал true.
 */
export function matchesGenre(
  itemGenres: string[],
  def: GenreDef,
): boolean {
  return itemGenres.includes(def.label) || (!!def.anilist && itemGenres.includes(def.anilist));
}

/**
 * Олон genre-ийн шүүлт mode-оос хамаарна: "and" — бүгд байх ёстой,
 * "or" — аль нэг нь хангалттай. Genre сонгоогүй бол бүгд өнгөрнө.
 */
export function matchesGenres(
  itemGenres: string[],
  defs: GenreDef[],
  mode: GenreMode,
): boolean {
  if (defs.length === 0) return true;
  return mode === "or"
    ? defs.some((d) => matchesGenre(itemGenres, d))
    : defs.every((d) => matchesGenre(itemGenres, d));
}

export function isGenreMode(v: string | null | undefined): v is GenreMode {
  return v === "and" || v === "or";
}
