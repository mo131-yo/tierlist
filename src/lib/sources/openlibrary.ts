// Open Library (key-гүй). Cover-гүй номыг ХАСАХГҮЙ — posterPath=null үлдээхэд
// PosterCard-ын текстэн fallback tile автоматаар харуулна (ховор ном алга болохгүй).
import type { NormalizedMedia } from "@/lib/tmdb";

interface OlDoc {
  key: string; // "/works/OL123W"
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  ratings_average?: number;
  ratings_count?: number;
  subject?: string[];
}

export async function searchOpenLibrary(
  query: string,
): Promise<NormalizedMedia[]> {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=20&fields=key,title,author_name,first_publish_year,cover_i,ratings_average,ratings_count,subject`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Open Library failed: ${res.status}`);
  const json = (await res.json()) as { docs: OlDoc[] };

  return json.docs.map((d): NormalizedMedia => {
    const workId = d.key.split("/").pop() ?? d.key;
    return {
      id: `book-${workId}`,
      tmdbId: 0,
      mediaType: "book",
      title: d.title,
      subtitle: d.author_name?.[0] ?? null,
      posterPath: d.cover_i
        ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`
        : null,
      backdropPath: null,
      overview: d.subject ? `Сэдвүүд: ${d.subject.slice(0, 8).join(", ")}` : "",
      genres: d.subject?.slice(0, 4) ?? [],
      year: d.first_publish_year ? String(d.first_publish_year) : null,
      rating: d.ratings_average ? d.ratings_average * 2 : 0, // 0-5 → 0-10
      popularity: d.ratings_count ?? 0,
    };
  });
}
