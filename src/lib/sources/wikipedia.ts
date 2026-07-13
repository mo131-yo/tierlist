// Wikipedia (key-гүй) — хоол, машин, спорт, хүн... юу ч хайж болно.
// Зураг = page thumbnail (600px хязгаартай — poster хэмжээнд хангалттай,
// DetailPanel-ийн том дэлгэцэд бүдэгдүү байж болохыг хүлээн зөвшөөрсөн, plan-д тэмдэглэсэн).
import type { NormalizedMedia } from "@/lib/tmdb";

interface WikiPage {
  pageid: number;
  title: string;
  index: number;
  thumbnail?: { source: string };
  description?: string;
  extract?: string;
}

export async function searchWikipedia(
  query: string,
): Promise<NormalizedMedia[]> {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "20",
    prop: "pageimages|description|extracts",
    piprop: "thumbnail",
    pithumbsize: "600",
    exintro: "1",
    explaintext: "1",
    exlimit: "20",
    format: "json",
    origin: "*",
  });
  const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Wikipedia failed: ${res.status}`);
  const json = (await res.json()) as {
    query?: { pages?: Record<string, WikiPage> };
  };

  const pages = Object.values(json.query?.pages ?? {});
  return pages
    .sort((a, b) => a.index - b.index) // хайлтын relevance эрэмбэ
    .filter((p) => p.thumbnail?.source) // зураггүй хуудсыг шүүнэ
    .map(
      (p): NormalizedMedia => ({
        id: `wiki-${p.pageid}`,
        tmdbId: p.pageid,
        mediaType: "wiki",
        title: p.title,
        subtitle: p.description ?? null,
        posterPath: p.thumbnail!.source,
        backdropPath: null,
        overview: p.extract?.slice(0, 600) ?? "",
        genres: [],
        year: null,
        rating: 0,
        popularity: 0,
      }),
    );
}
