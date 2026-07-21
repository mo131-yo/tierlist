import { NextRequest, NextResponse, after } from "next/server";
import { cachedBrowse, refreshBrowse } from "@/db/queries";
import { isBrowseCategory, RateLimitError } from "@/lib/sources";
import {
  BROWSE_GENRES,
  BROWSE_SORTS,
  isGenreMode,
  type BrowseSort,
  type GenreMode,
} from "@/lib/genres";

// Browse хуудсууд query-ээс ч сайн кэшлэгдэнэ (популярлаг удаан өөрчлөгддөг)
const CACHE_HEADER = "public, s-maxage=21600, stale-while-revalidate=86400";

const MAX_PAGE = 50;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const cat = sp.get("cat");
  if (!isBrowseCategory(cat)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const sortParam = sp.get("sort");
  const sort: BrowseSort = (BROWSE_SORTS as readonly string[]).includes(
    sortParam ?? "",
  )
    ? (sortParam as BrowseSort)
    : "popularity";

  const modeParam = sp.get("mode");
  const mode: GenreMode = isGenreMode(modeParam) ? modeParam : "and";

  const page = Math.min(
    MAX_PAGE,
    Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1),
  );

  // Зөвхөн энэ category-д байдаг slug-уудыг үлдээнэ (cache key-г цэвэр байлгана)
  const known = new Set(BROWSE_GENRES[cat].map((g) => g.slug));
  const genreSlugs = (sp.get("genres") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => known.has(s));

  try {
    const t0 = performance.now();
    const opts = { genreSlugs, sort, page, mode };
    const { items, hasMore, cache } = await cachedBrowse(cat, opts);
    console.log(
      `[browse] ${cat} sort=${sort} genres=[${genreSlugs.join(",")}]/${mode} p${page} cache ${cache} — ${items.length} items in ${(performance.now() - t0).toFixed(1)}ms`,
    );
    if (cache === "STALE") {
      after(() => refreshBrowse(cat, opts));
    }
    return NextResponse.json(
      { items, hasMore, cache },
      { headers: { "Cache-Control": CACHE_HEADER } },
    );
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    console.error(`[browse] ${cat} failed:`, err);
    return NextResponse.json({ error: "Browse failed" }, { status: 500 });
  }
}
