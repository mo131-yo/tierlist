import { searchTmdb, type NormalizedMedia } from "@/lib/tmdb";
import { searchAnilist, searchAnilistCharacters } from "./anilist";
import { searchOpenLibrary } from "./openlibrary";
import { searchWikipedia } from "./wikipedia";

import { CATEGORIES, type Category } from "@/lib/types";

export { RateLimitError } from "./anilist";
export { categoryOfItemId, sourceOfItemId, CATEGORIES } from "@/lib/types";
export type { Category };

export function isCategory(v: string | null): v is Category {
  return !!v && (CATEGORIES as readonly string[]).includes(v);
}

export async function searchSource(
  cat: Category,
  query: string,
): Promise<NormalizedMedia[]> {
  switch (cat) {
    case "movies":
      return searchTmdb(query);
    case "anime":
      return searchAnilist(query);
    case "character":
      return searchAnilistCharacters(query);
    case "book":
      return searchOpenLibrary(query);
    case "wiki":
      return searchWikipedia(query);
  }
}

