// AniList GraphQL (key-гүй нийтийн API, ~30-90 req/мин rate limit-тэй)
import type { NormalizedMedia } from "@/lib/tmdb";

const ANILIST_URL = "https://graphql.anilist.co";

/** AniList-ийн rate limit-д хүрсэн үед /api/search 429 буцаахад ашиглана */
export class RateLimitError extends Error {
  constructor() {
    super("AniList rate limited");
    this.name = "RateLimitError";
  }
}

function stripHtml(s: string | null | undefined): string {
  return (s ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

/** 429 үед exponential backoff-той (600ms → 1800ms, Retry-After мөрдөнө) fetch */
async function anilistFetch(query: string, variables: Record<string, unknown>) {
  const delays = [600, 1800];
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(ANILIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if (res.status === 429) {
      if (attempt >= delays.length) throw new RateLimitError();
      const retryAfter = Number(res.headers.get("Retry-After"));
      const waitMs =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 5000)
          : delays[attempt];
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
    if (!res.ok) throw new Error(`AniList failed: ${res.status}`);
    return (await res.json()) as { data: Record<string, unknown> };
  }
}

interface AlMedia {
  id: number;
  title: { romaji: string | null; english: string | null };
  coverImage: { extraLarge: string | null; large: string | null };
  bannerImage: string | null;
  description: string | null;
  genres: string[] | null;
  startDate: { year: number | null } | null;
  averageScore: number | null;
  popularity: number | null;
}

const MEDIA_FIELDS = `
  id
  title { romaji english }
  coverImage { extraLarge large }
  bannerImage
  description
  genres
  startDate { year }
  averageScore
  popularity
`;

function mapMedia(m: AlMedia, kind: "anime" | "manga"): NormalizedMedia {
  return {
    id: `${kind === "anime" ? "al-a" : "al-m"}-${m.id}`,
    tmdbId: m.id,
    mediaType: kind,
    title: m.title.english ?? m.title.romaji ?? "Untitled",
    subtitle: null,
    posterPath: m.coverImage.extraLarge ?? m.coverImage.large,
    backdropPath: m.bannerImage,
    overview: stripHtml(m.description),
    genres: m.genres ?? [],
    year: m.startDate?.year ? String(m.startDate.year) : null,
    rating: m.averageScore ? m.averageScore / 10 : 0, // 0-100 → 0-10
    popularity: m.popularity ?? 0,
  };
}

async function searchAnilistMedia(
  query: string,
  type: "ANIME" | "MANGA",
  extraFilter = "",
  perPage = 50,
): Promise<NormalizedMedia[]> {
  const gql = `
    query ($search: String) {
      Page(perPage: ${perPage}) {
        media(search: $search, type: ${type}${extraFilter}, sort: SEARCH_MATCH) { ${MEDIA_FIELDS} }
      }
    }`;
  const json = await anilistFetch(gql, { search: query });
  const data = json.data as { Page: { media: AlMedia[] } };
  return data.Page.media
    .map((m) => mapMedia(m, type === "ANIME" ? "anime" : "manga"))
    .filter((m) => m.posterPath);
}

export function searchAnilistAnime(query: string) {
  return searchAnilistMedia(query, "ANIME");
}

export function searchAnilistManga(query: string) {
  return searchAnilistMedia(query, "MANGA");
}

/**
 * Улирлын хайлтад зориулсан: AniList дээр анимегийн улирал бүр тусдаа бүртгэл
 * байдаг (ж: "BLUE LOCK" ба "BLUE LOCK Season 2") — TMDB улирлуудыг нэгтгэсэн
 * үед (Blue Lock кейс) эндээс жинхэнэ улирлын задаргаа гарна.
 * Зөвхөн цуврал хэлбэрийг (TV, TV_SHORT, ONA) авна — кино/OVA хасагдана.
 */
export function searchAnilistTvSeasons(query: string) {
  return searchAnilistMedia(
    query,
    "ANIME",
    ", format_in: [TV, TV_SHORT, ONA]",
    25,
  );
}

interface AlCharacter {
  id: number;
  name: { full: string | null };
  image: { large: string | null };
  description: string | null;
  favourites: number | null;
  media: { nodes: { title: { romaji: string | null; english: string | null } }[] };
}

/** Аниме/мангагийн дүрүүд — subtitle нь харьяалагдах гол бүтээл */
export async function searchAnilistCharacters(
  query: string,
): Promise<NormalizedMedia[]> {
  const gql = `
    query ($search: String) {
      Page(perPage: 50) {
        characters(search: $search, sort: SEARCH_MATCH) {
          id
          name { full }
          image { large }
          description
          favourites
          media(perPage: 1, sort: POPULARITY_DESC) {
            nodes { title { romaji english } }
          }
        }
      }
    }`;
  const json = await anilistFetch(gql, { search: query });
  const chars = (json.data as { Page: { characters: AlCharacter[] } }).Page
    .characters;

  return chars
    .map((c): NormalizedMedia => {
      const origin = c.media.nodes[0]?.title;
      return {
        id: `al-c-${c.id}`,
        tmdbId: c.id,
        mediaType: "character",
        title: c.name.full ?? "Unknown",
        subtitle: origin ? (origin.english ?? origin.romaji) : null,
        posterPath: c.image.large,
        backdropPath: null,
        overview: stripHtml(c.description),
        genres: [],
        year: null,
        rating: 0,
        popularity: c.favourites ?? 0,
      };
    })
    .filter((m) => m.posterPath);
}
