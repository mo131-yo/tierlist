// Зургийн эх сурвалжийн abstraction.
// Phase 1: TMDB CDN URL шууд буцаана (URL нь DB-д кэшлэгдсэн path дээр тулгуурлана).
// Phase 2 (Supabase): анх хайхад зургийг Supabase Storage bucket-д хуулж,
// public URL-ийг media_items хүснэгтэд хадгалаад эндээс тэр URL-ийг буцаадаг болгоно —
// UI талын код өөрчлөгдөхгүй.

const TMDB_IMG = "https://image.tmdb.org/t/p";

export function getPosterUrl(
  posterPath: string | null,
  size: "w185" | "w342" | "w500" = "w342",
): string | null {
  if (!posterPath) return null;
  if (posterPath.startsWith("http")) return posterPath; // Phase 2: storage URL
  return `${TMDB_IMG}/${size}${posterPath}`;
}

export function getBackdropUrl(
  backdropPath: string | null,
  size: "w1280" | "original" = "original",
): string | null {
  if (!backdropPath) return null;
  if (backdropPath.startsWith("http")) return backdropPath;
  return `${TMDB_IMG}/${size}${backdropPath}`;
}
