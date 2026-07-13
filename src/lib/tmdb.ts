// TMDB API client (server-only) + genre constant.
// Genre жагсаалт TMDB дээр өөрчлөгддөггүй тул API дуудалт хэмнэж статик хадгалав.

const TMDB_BASE = process.env.TMDB_BASE_URL ?? "https://api.themoviedb.org/3";

export const GENRES: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
};

export interface TmdbSearchResult {
  id: number;
  media_type: "movie" | "tv" | "person";
  title?: string; // movie
  name?: string; // tv
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  genre_ids: number[];
  release_date?: string; // movie
  first_air_date?: string; // tv
  vote_average: number;
  popularity: number;
}

export interface NormalizedMedia {
  id: string;
  tmdbId: number;
  mediaType: string; // movie | tv | anime | manga | character | book | wiki
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

export async function searchTmdb(query: string): Promise<NormalizedMedia[]> {
  const url = `${TMDB_BASE}/search/multi?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.TMDB_API_TOKEN}`,
      accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`TMDB search failed: ${res.status}`);
  const json = (await res.json()) as { results: TmdbSearchResult[] };

  return json.results
    .filter(
      (r): r is TmdbSearchResult & { media_type: "movie" | "tv" } =>
        (r.media_type === "movie" || r.media_type === "tv") &&
        Boolean(r.poster_path),
    )
    .map((r) => ({
      id: `${r.media_type}-${r.id}`,
      tmdbId: r.id,
      mediaType: r.media_type,
      title: (r.media_type === "movie" ? r.title : r.name) ?? "Untitled",
      subtitle: null,
      posterPath: r.poster_path,
      backdropPath: r.backdrop_path,
      overview: r.overview ?? "",
      genres: (r.genre_ids ?? []).map((g) => GENRES[g]).filter(Boolean),
      year:
        (r.media_type === "movie" ? r.release_date : r.first_air_date)?.slice(
          0,
          4,
        ) || null,
      rating: r.vote_average ?? 0,
      popularity: r.popularity ?? 0,
    }));
}
