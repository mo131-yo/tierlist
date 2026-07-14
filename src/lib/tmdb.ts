// TMDB API client (server-only) + genre constant.
// Genre жагсаалт TMDB дээр өөрчлөгддөггүй тул API дуудалт хэмнэж статик хадгалав.

import { allTokensExact } from "@/lib/relevance";

// .env-ийн утга буруу/дутуу байсан ч ажиллах хамгаалалт:
// зөв домэйнтэй үед л env-ийн base URL-ийг хэрэглэнэ
const envBase = process.env.TMDB_BASE_URL?.trim();
const TMDB_BASE = envBase?.includes("api.themoviedb.org")
  ? envBase
  : "https://api.themoviedb.org/3";

// Bearer JWT ('.'-тэй урт токен) эсвэл v3 api_key-ийн аль байгааг нь ашиглана
function tmdbAuth(): { header?: string; apiKey?: string } {
  const candidates = [
    process.env.TMDB_API_TOKEN,
    process.env.NEXT_API_TOKEN,
  ].map((s) => s?.trim());
  for (const c of candidates) {
    if (c && c.includes(".")) return { header: `Bearer ${c}` };
  }
  const key = (
    process.env.TMDB_API_KEY ??
    process.env.NEXT_PUBLIC_TMDB_API_KEY ??
    process.env.TMDB_API_TOKEN
  )?.trim();
  return key ? { apiKey: key } : {};
}

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

async function tmdbGet(path: string): Promise<Response> {
  const auth = tmdbAuth();
  const url = auth.apiKey
    ? `${TMDB_BASE}${path}${path.includes("?") ? "&" : "?"}api_key=${auth.apiKey}`
    : `${TMDB_BASE}${path}`;
  return fetch(url, {
    headers: {
      ...(auth.header ? { Authorization: auth.header } : {}),
      accept: "application/json",
    },
  });
}

interface TmdbTvDetails {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  popularity: number;
  genres: { id: number; name: string }[];
  seasons: {
    season_number: number;
    name: string;
    poster_path: string | null;
    overview: string;
    air_date: string | null;
    episode_count: number;
    vote_average: number;
  }[];
}

const MAX_SHOWS_FOR_SEASONS = 8;
const MAX_SEASON_RESULTS = 60;

/**
 * Улирлын хайлт: сериал хайгаад шилдэг тохирлуудын дэлгэрэнгүйг зэрэг татаж,
 * улирал бүрийг тусдаа item болгож задална (id: season-{tvId}-{n}).
 */
export async function searchTvSeasons(
  query: string,
): Promise<NormalizedMedia[]> {
  const searchRes = await tmdbGet(
    `/search/tv?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`,
  );
  if (!searchRes.ok) throw new Error(`TMDB tv search failed: ${searchRes.status}`);
  const searchJson = (await searchRes.json()) as {
    results: { id: number; poster_path: string | null }[];
  };

  const topShows = searchJson.results
    .filter((r) => r.poster_path)
    .slice(0, MAX_SHOWS_FOR_SEASONS);

  const details = await Promise.all(
    topShows.map(async (s) => {
      const res = await tmdbGet(`/tv/${s.id}?language=en-US`);
      return res.ok ? ((await res.json()) as TmdbTvDetails) : null;
    }),
  );

  const items: NormalizedMedia[] = [];
  for (const show of details) {
    if (!show) continue;
    const genres = show.genres.map((g) => g.name);
    for (const season of show.seasons) {
      if (season.season_number === 0) continue; // Specials — tier-т утга багатай
      const poster = season.poster_path ?? show.poster_path;
      if (!poster) continue;
      items.push({
        id: `season-${show.id}-${season.season_number}`,
        tmdbId: show.id,
        mediaType: "season",
        title: `${show.name} S${season.season_number}`,
        subtitle: `${season.name} · ${season.episode_count} анги`,
        posterPath: poster,
        backdropPath: show.backdrop_path,
        overview: season.overview || show.overview,
        genres,
        year: season.air_date?.slice(0, 4) || null,
        rating: season.vote_average ?? 0,
        popularity: show.popularity ?? 0,
      });
    }
  }
  return items.slice(0, MAX_SEASON_RESULTS);
}

function mapTmdbResult(
  r: TmdbSearchResult,
  type: "movie" | "tv",
): NormalizedMedia {
  return {
    id: `${type}-${r.id}`,
    tmdbId: r.id,
    mediaType: type,
    title: (type === "movie" ? r.title : r.name) ?? "Untitled",
    subtitle: null,
    posterPath: r.poster_path,
    backdropPath: r.backdrop_path,
    overview: r.overview ?? "",
    genres: (r.genre_ids ?? []).map((g) => GENRES[g]).filter(Boolean),
    year:
      (type === "movie" ? r.release_date : r.first_air_date)?.slice(0, 4) ||
      null,
    rating: r.vote_average ?? 0,
    popularity: r.popularity ?? 0,
  };
}

/** 2 хуудсыг зэрэг татаж (40 хүртэл үр дүн) бүрэн байдлыг нэмнэ */
async function tmdbSearchPages(
  endpoint: "movie" | "tv",
  query: string,
): Promise<TmdbSearchResult[]> {
  const pages = await Promise.all(
    [1, 2].map(async (page) => {
      const res = await tmdbGet(
        `/search/${endpoint}?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=${page}`,
      );
      if (!res.ok) {
        if (page === 1) throw new Error(`TMDB search failed: ${res.status}`);
        return { results: [] as TmdbSearchResult[] };
      }
      return (await res.json()) as { results: TmdbSearchResult[] };
    }),
  );
  return pages.flatMap((p) => p.results);
}

/**
 * Утгачилсан (франчайз/студи) хайлт: "marvel", "dc", "ghibli" гэх мэт query
 * студийн нэртэй яг таарвал тухайн компанийн БҮХ бүтээлийг popularity-аар татна.
 * Guard: query-ийн бүх үг компанийн нэрний үгсэд ЯГ байх ёстой
 * ("car" ≠ "Carolco" — санамсаргүй идэвхжихгүй).
 */
async function tmdbCompanyDiscover(
  endpoint: "movie" | "tv",
  query: string,
): Promise<NormalizedMedia[]> {
  const res = await tmdbGet(
    `/search/company?query=${encodeURIComponent(query)}&page=1`,
  );
  if (!res.ok) return [];
  const json = (await res.json()) as {
    results: { id: number; name: string }[];
  };
  const companies = json.results
    .filter((c) => allTokensExact(query, c.name))
    .slice(0, 3);
  if (companies.length === 0) return [];

  const ids = companies.map((c) => c.id).join("|"); // OR холбоос
  const pages = await Promise.all(
    [1, 2].map(async (page) => {
      const r = await tmdbGet(
        `/discover/${endpoint}?with_companies=${ids}&sort_by=popularity.desc&include_adult=false&language=en-US&page=${page}`,
      );
      return r.ok
        ? ((await r.json()) as { results: TmdbSearchResult[] })
        : { results: [] };
    }),
  );
  return pages
    .flatMap((p) => p.results)
    .filter((r) => r.poster_path)
    .map((r) => mapTmdbResult(r, endpoint));
}

async function searchTmdbWithCompanies(
  endpoint: "movie" | "tv",
  query: string,
): Promise<NormalizedMedia[]> {
  const [titleRes, companyRes] = await Promise.allSettled([
    tmdbSearchPages(endpoint, query),
    tmdbCompanyDiscover(endpoint, query),
  ]);
  const byTitle =
    titleRes.status === "fulfilled"
      ? titleRes.value
          .filter((r) => r.poster_path)
          .map((r) => mapTmdbResult(r, endpoint))
      : [];
  const byCompany = companyRes.status === "fulfilled" ? companyRes.value : [];

  // Нэрээр таарсан нь эхэндээ, франчайзын бусад бүтээл ард нь (давхардал хасна)
  const seen = new Set(byTitle.map((i) => i.id));
  return [...byTitle, ...byCompany.filter((i) => !seen.has(i.id))];
}

export function searchTmdbMovies(query: string): Promise<NormalizedMedia[]> {
  return searchTmdbWithCompanies("movie", query);
}

export function searchTmdbTv(query: string): Promise<NormalizedMedia[]> {
  return searchTmdbWithCompanies("tv", query);
}
