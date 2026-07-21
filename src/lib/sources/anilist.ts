// AniList GraphQL (key-гүй нийтийн API, ~30-90 req/мин rate limit-тэй)
import type { NormalizedMedia } from "@/lib/tmdb";
import type { BrowseSort, GenreMode } from "@/lib/genres";
import { scoreMatch, allTokensExact, rankScored } from "@/lib/relevance";
import { dedupeById, interleave } from "@/lib/batch";

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
  type?: "ANIME" | "MANGA";
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
  type
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

/** Нэрээр хайж, relevance-аар эрэмбэлээд хамааралгүй "сүүл"-ийг хаяна */
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
  const kind = type === "ANIME" ? "anime" : "manga";
  // Fuzzy хайлтын хамааралгүй үр дүнг (ж: "spider man" → Haikyu) хасна:
  // score-г англи + ромажи нэр хоёулан дээр тооцно
  return rankScored(
    data.Page.media
      .filter((m) => m.coverImage.extraLarge ?? m.coverImage.large)
      .map((m) => ({
        item: mapMedia(m, kind),
        score: scoreMatch(query, m.title.romaji, m.title.english),
      })),
    true,
  );
}

/**
 * Студийн хайлт (утгачилсан): "ghibli" → Studio Ghibli-ийн бүх бүтээл
 * popularity дарааллаар. Guard: query-ийн бүх үг студийн нэрэнд яг байх ёстой.
 */
async function searchAnilistStudioMedia(
  query: string,
  kind: "anime" | "manga",
): Promise<NormalizedMedia[]> {
  const gql = `
    query ($search: String) {
      Studio(search: $search) {
        name
        media(sort: POPULARITY_DESC, perPage: 50, isMain: true) {
          nodes { ${MEDIA_FIELDS} }
        }
      }
    }`;
  let json;
  try {
    json = await anilistFetch(gql, { search: query });
  } catch (err) {
    if (err instanceof RateLimitError) throw err;
    return []; // Studio олдоогүй үед AniList заримдаа error буцаадаг
  }
  const studio = (json.data as {
    Studio: { name: string; media: { nodes: AlMedia[] } } | null;
  }).Studio;
  if (!studio || !allTokensExact(query, studio.name)) return [];
  const wantType = kind === "anime" ? "ANIME" : "MANGA";
  return studio.media.nodes
    .filter((m) => m.type === wantType)
    .filter((m) => m.coverImage.extraLarge ?? m.coverImage.large)
    .map((m) => mapMedia(m, kind));
}

/** Аниме таб: нэрийн хайлт + студийн франчайз хайлт зэрэг */
export async function searchAnilistAnime(
  query: string,
): Promise<NormalizedMedia[]> {
  const [byTitle, byStudio] = await Promise.allSettled([
    searchAnilistMedia(query, "ANIME"),
    searchAnilistStudioMedia(query, "anime"),
  ]);
  if (byTitle.status === "rejected" && byTitle.reason instanceof RateLimitError)
    throw byTitle.reason;
  const title = byTitle.status === "fulfilled" ? byTitle.value : [];
  const studio = byStudio.status === "fulfilled" ? byStudio.value : [];
  const seen = new Set(title.map((i) => i.id));
  return [...title, ...studio.filter((i) => !seen.has(i.id))];
}

export function searchAnilistManga(query: string) {
  return searchAnilistMedia(query, "MANGA");
}

const ANILIST_BROWSE_SORT: Record<BrowseSort, string> = {
  popularity: "POPULARITY_DESC",
  rating: "SCORE_DESC",
  newest: "START_DATE_DESC",
};

/** OR горимд зэрэг явуулах хүсэлтийн дээд хязгаар (rate limit хамгаалалт) */
const MAX_OR_GENRES = 4;

/** Нэг genre багц (AND) дээрх нэг хуудас */
async function browseAnilistPage(
  type: "ANIME" | "MANGA",
  genres: string[],
  sort: BrowseSort,
  page: number,
): Promise<{ items: NormalizedMedia[]; hasMore: boolean }> {
  const gql = `
    query ($page: Int, $genres: [String], $sort: [MediaSort], $status: [MediaStatus]) {
      Page(page: $page, perPage: 30) {
        pageInfo { hasNextPage }
        media(type: ${type}, genre_in: $genres, sort: $sort, status_in: $status, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }`;
  const json = await anilistFetch(gql, {
    page,
    // genre_in: [] нь AniList дээр 0 үр дүн өгдөг тул хоосон үед undefined
    genres: genres.length > 0 ? genres : undefined,
    sort: [ANILIST_BROWSE_SORT[sort]],
    // newest дээр status шүүхгүй бол зөвхөн TBA/гараагүй бүртгэл эхэнд гарна
    status: sort === "newest" ? ["RELEASING", "FINISHED"] : undefined,
  });
  const data = json.data as {
    Page: { pageInfo: { hasNextPage: boolean }; media: AlMedia[] };
  };
  const kind = type === "ANIME" ? "anime" : "manga";
  return {
    items: data.Page.media
      .filter((m) => m.coverImage.extraLarge ?? m.coverImage.large)
      .map((m) => mapMedia(m, kind)),
    hasMore: data.Page.pageInfo.hasNextPage,
  };
}

/**
 * Browse горим: хайлтгүйгээр genre + эрэмбээр хуудаслаж үзэх.
 * AniList-ийн `genre_in` нь эмпирикээр шалгахад **AND** (бүх genre таарна).
 * Тиймээс OR горимд native дэмжлэг байхгүй — genre тус бүрээр зэрэг татаж
 * round-robin-аар нийлүүлж, давхардлыг арилгана (кэш нь өдөрт нэг л удаа
 * ийм хүсэлт явуулна).
 */
export async function browseAnilist(
  type: "ANIME" | "MANGA",
  opts: { genres: string[]; sort: BrowseSort; page: number; mode: GenreMode },
): Promise<{ items: NormalizedMedia[]; hasMore: boolean }> {
  if (opts.mode !== "or" || opts.genres.length < 2) {
    return browseAnilistPage(type, opts.genres, opts.sort, opts.page);
  }

  const settled = await Promise.allSettled(
    opts.genres
      .slice(0, MAX_OR_GENRES)
      .map((g) => browseAnilistPage(type, [g], opts.sort, opts.page)),
  );
  // Бүгд унасан бол (ж: rate limit) алдааг нь дээш дамжуулна
  const ok = settled.filter((s) => s.status === "fulfilled");
  if (ok.length === 0) {
    const first = settled[0];
    throw first?.status === "rejected" ? first.reason : new Error("AniList browse failed");
  }
  return {
    items: dedupeById(interleave(ok.map((s) => s.value.items))),
    hasMore: ok.some((s) => s.value.hasMore),
  };
}

/** «Бүгд» табд зориулсан хөнгөн хувилбарууд (rate limit хэмнэнэ) */
export function searchAnilistAnimeLight(query: string) {
  return searchAnilistMedia(query, "ANIME", "", 30);
}
export function searchAnilistMangaLight(query: string) {
  return searchAnilistMedia(query, "MANGA", "", 30);
}

/**
 * Улирлын хайлтад зориулсан: AniList дээр анимегийн улирал бүр тусдаа бүртгэл
 * байдаг (ж: "BLUE LOCK" ба "BLUE LOCK Season 2") — TMDB улирлуудыг нэгтгэсэн
 * үед (Blue Lock кейс) эндээс жинхэнэ улирлын задаргаа гарна.
 * Зөвхөн цуврал хэлбэрийг (TV, TV_SHORT, ONA) авна — кино/OVA хасагдана.
 */
export function searchAnilistTvSeasons(query: string) {
  return searchAnilistMedia(query, "ANIME", ", format_in: [TV, TV_SHORT, ONA]", 25);
}

interface AlCharacter {
  id: number;
  name: { full: string | null };
  image: { large: string | null };
  description: string | null;
  favourites: number | null;
  media?: { nodes: { title: { romaji: string | null; english: string | null } }[] };
}

function mapCharacter(c: AlCharacter, subtitle: string | null): NormalizedMedia {
  return {
    id: `al-c-${c.id}`,
    tmdbId: c.id,
    mediaType: "character",
    title: c.name.full ?? "Unknown",
    subtitle,
    posterPath: c.image.large,
    backdropPath: null,
    overview: stripHtml(c.description),
    genres: [],
    year: null,
    rating: 0,
    popularity: c.favourites ?? 0,
  };
}

/** Нэрээр нь дүр хайх (хөнгөн хувилбар — «Бүгд» таб мөн ашиглана) */
export async function searchAnilistCharactersLight(
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
  return rankScored(
    chars
      .filter((c) => c.image.large)
      .map((c) => {
        const origin = c.media?.nodes[0]?.title;
        const subtitle = origin ? (origin.english ?? origin.romaji) : null;
        return {
          item: mapCharacter(c, subtitle),
          score: scoreMatch(query, c.name.full, subtitle),
        };
      }),
    true,
  );
}

const ROSTER_PAGES = 6; // 6 × 25 = 150 дүр — нэг GraphQL request-ээр

/**
 * Аниме/мангагийн НЭРЭЭР хайхад тухайн бүтээлийн БҮХ дүрийг (хамгийн
 * алдартайгаас үл танигдах хүртэл, favourites дарааллаар) гаргана.
 * Guard: query нь бүтээлийн нэртэй яг таарсан үед л идэвхжинэ
 * ("levi" → "Levius"-ийн roster санамсаргүй гарахгүй).
 */
async function searchCharacterRoster(
  query: string,
): Promise<NormalizedMedia[]> {
  const pageAliases = Array.from(
    { length: ROSTER_PAGES },
    (_, i) => `
      c${i + 1}: characters(page: ${i + 1}, perPage: 25, sort: FAVOURITES_DESC) {
        nodes { id name { full } image { large } description favourites }
      }`,
  ).join("\n");
  const gql = `
    query ($search: String) {
      Media(search: $search, sort: SEARCH_MATCH) {
        title { romaji english }
        ${pageAliases}
      }
    }`;
  let json;
  try {
    json = await anilistFetch(gql, { search: query });
  } catch (err) {
    if (err instanceof RateLimitError) throw err;
    return [];
  }
  const media = (json.data as Record<string, unknown>).Media as
    | ({ title: { romaji: string | null; english: string | null } } & Record<
        string,
        { nodes: AlCharacter[] }
      >)
    | null;
  if (!media) return [];

  const romaji = media.title.romaji ?? "";
  const english = media.title.english ?? "";
  const exact =
    scoreMatch(query, romaji, english) === 100 ||
    (english && allTokensExact(query, english)) ||
    (romaji && allTokensExact(query, romaji));
  if (!exact) return [];

  const subtitle = english || romaji || null;
  const seen = new Set<number>();
  const out: NormalizedMedia[] = [];
  for (let i = 1; i <= ROSTER_PAGES; i++) {
    for (const c of media[`c${i}`]?.nodes ?? []) {
      if (seen.has(c.id) || !c.image.large) continue;
      seen.add(c.id);
      out.push(mapCharacter(c, subtitle));
    }
  }
  return out;
}

/** Дүр таб: нэрийн хайлт + бүтээлийн нэрээр бүх дүрийн roster зэрэг */
export async function searchAnilistCharacters(
  query: string,
): Promise<NormalizedMedia[]> {
  const [direct, roster] = await Promise.allSettled([
    searchAnilistCharactersLight(query),
    searchCharacterRoster(query),
  ]);
  if (direct.status === "rejected" && direct.reason instanceof RateLimitError)
    throw direct.reason;
  const d = direct.status === "fulfilled" ? direct.value : [];
  const r = roster.status === "fulfilled" ? roster.value : [];
  if (r.length === 0) return d;
  // Бүтээлийн нэр яг таарсан → roster-ийг түрүүлж (алдартай → танигдаагүй),
  // нэрээрээ таарсан бусад дүрийг ард нь
  const seen = new Set(r.map((i) => i.id));
  return [...r, ...d.filter((i) => !seen.has(i.id))];
}
