"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Loader2,
  LayoutGrid,
  Film,
  Tv,
  Layers,
  Sparkles,
  BookText,
  User,
  BookOpen,
  Globe,
  Flame,
  Star,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MediaGrid } from "./MediaGrid";
import { POSTER_H } from "./PosterCard";
import {
  BROWSE_CATS,
  BROWSE_GENRES,
  matchesGenres,
  type BrowseCat,
  type BrowseSort,
  type GenreMode,
} from "@/lib/genres";
import type { Category, MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 150;
const CLIENT_CACHE_MAX = 50; // LRU: үүнээс хэтэрвэл хамгийн хуучин query устгагдана

const CATEGORY_TABS: {
  cat: Category;
  label: string;
  Icon: LucideIcon;
  placeholder: string;
}[] = [
  { cat: "all", label: "Бүгд", Icon: LayoutGrid, placeholder: "Юу ч хай — кино, аниме, дүр, ном, хоол…" },
  { cat: "movie", label: "Кино", Icon: Film, placeholder: "Кино хайх… (хоосон үлдээвэл бүгдийг үзүүлнэ)" },
  { cat: "tv", label: "Сериал", Icon: Tv, placeholder: "Сериал хайх… (хоосон үлдээвэл бүгдийг үзүүлнэ)" },
  { cat: "season", label: "Улирал", Icon: Layers, placeholder: "Сериалын нэрээр хайхад улирал бүр нь гарна… (ж: stranger things)" },
  { cat: "anime", label: "Аниме", Icon: Sparkles, placeholder: "Аниме хайх… (хоосон үлдээвэл бүгдийг үзүүлнэ)" },
  { cat: "manga", label: "Манга", Icon: BookText, placeholder: "Манга хайх… (хоосон үлдээвэл бүгдийг үзүүлнэ)" },
  { cat: "character", label: "Дүр", Icon: User, placeholder: "Аниме/мангагийн дүр хайх… (ж: levi, gojo)" },
  { cat: "book", label: "Ном", Icon: BookOpen, placeholder: "Ном хайх… (ж: harry potter, dune)" },
  { cat: "wiki", label: "Бусад", Icon: Globe, placeholder: "Юу ч хай: хуушуур, ferrari, messi…" },
];

const SORT_TABS: { sort: BrowseSort; label: string; Icon: LucideIcon }[] = [
  { sort: "popularity", label: "Алдартай", Icon: Flame },
  { sort: "rating", label: "Үнэлгээ", Icon: Star },
  { sort: "newest", label: "Шинэ", Icon: CalendarClock },
];

// Эдгээр таб дээр poster доор subtitle гарна (холимог/ижил нэртэй үр дүнг ялгахад)
const SUBTITLE_CATS: ReadonlySet<Category> = new Set(["character", "season", "all"]);

function isBrowseCat(c: Category): c is BrowseCat {
  return (BROWSE_CATS as readonly string[]).includes(c);
}

// ---- Client кэш: хайлт (MediaItem[]) + browse ({items, hasMore}) ----
// sessionStorage-д хадгалснаар page reload-ийн дараа ч агшинд гарна.

const SESSION_KEY = "ct-search-cache-v1";
const clientCache = new Map<string, MediaItem[]>();
const browseCache = new Map<string, { items: MediaItem[]; hasMore: boolean }>();
let cacheHydrated = false;

function hydrateCache() {
  if (cacheHydrated) return;
  cacheHydrated = true;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    for (const [k, v] of JSON.parse(raw) as [string, MediaItem[]][]) {
      clientCache.set(k, v);
    }
  } catch {
    /* quota/parse алдаа — кэшгүй үргэлжилнэ */
  }
}

function persistCache() {
  try {
    // Сүүлийн 20 query, тус бүр эхний 30 item — quota-д багтана
    const entries = [...clientCache.entries()]
      .slice(-20)
      .map(([k, v]) => [k, v.slice(0, 30)]);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(entries));
  } catch {
    /* хадгалж чадаагүй нь чухал биш */
  }
}

function lruGet<V>(map: Map<string, V>, key: string): V | undefined {
  const v = map.get(key);
  if (v !== undefined) {
    // recency шинэчилнэ: delete + set нь key-г Map-ийн төгсгөлд шилжүүлнэ
    map.delete(key);
    map.set(key, v);
  }
  return v;
}

function lruSet<V>(map: Map<string, V>, key: string, value: V) {
  if (map.size >= CLIENT_CACHE_MAX && !map.has(key)) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, value);
}

export function SearchTray({
  boardItemIds,
  watchLaterIds,
  selectedId,
  onSelect,
  onPick,
  onWatchLater,
}: {
  boardItemIds: Set<string>;
  watchLaterIds: Set<string>;
  selectedId: string | null;
  onSelect: (item: MediaItem) => void;
  onPick?: (item: MediaItem, anchor: HTMLElement) => void;
  onWatchLater?: (item: MediaItem) => void;
}) {
  const [cat, setCat] = useState<Category>("all");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestKey = useRef("");

  // ---- Browse (хайлтгүй үзэх) төлөв ----
  const [selGenres, setSelGenres] = useState<string[]>([]);
  const [genreMode, setGenreMode] = useState<GenreMode>("and");
  const [sort, setSort] = useState<BrowseSort>("popularity");
  const [browseItems, setBrowseItems] = useState<MediaItem[]>([]);
  const [browsePage, setBrowsePage] = useState(1);
  const [browseHasMore, setBrowseHasMore] = useState(false);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseAppending, setBrowseAppending] = useState(false);
  const browseAbortRef = useRef<AbortController | null>(null);
  const browseKeyRef = useRef("");

  const browseMode = !query.trim() && isBrowseCat(cat);

  useEffect(() => {
    hydrateCache();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
      browseAbortRef.current?.abort();
    };
  }, []);

  // ---- Хайлт ----
  async function fetchQuery(activeCat: Category, q: string) {
    const key = `${activeCat}:${q}`;
    abortRef.current?.abort(); // нисэж буй өмнөх request-ийг цуцална (сүүлийнх нь ялна)
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch(
        `/api/search?cat=${activeCat}&q=${encodeURIComponent(q)}`,
        { signal: ac.signal },
      );
      if (res.status === 429) {
        // AniList rate limit — кэшлэхгүй, inline мессеж харуулна
        if (latestKey.current === key) {
          setRateLimited(true);
          setResults([]);
          setLoading(false);
        }
        return;
      }
      const json = (await res.json()) as { items: MediaItem[] };
      const items = json.items ?? [];
      lruSet(clientCache, key, items);
      persistCache();
      // Stale guard: хариу ирэх хооронд query/cat өөрчлөгдсөн бол render хийхгүй
      if (latestKey.current === key) {
        setResults(items);
        setLoading(false);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError" && latestKey.current === key) {
        setLoading(false);
      }
    }
  }

  function startSearch(activeCat: Category, value: string) {
    const q = value.trim().toLowerCase();
    const key = `${activeCat}:${q}`;
    latestKey.current = key;
    setRateLimited(false);

    // Debounce: завсрын query (n, na, nar...) энд устгагдах тул сервер лүү явдаггүй
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!q) {
      setResults([]);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }

    // Client LRU кэш: агшин зуур, сервер лүү огт явахгүй
    const cached = lruGet(clientCache, key);
    if (cached) {
      setResults(cached);
      setLoading(false);
      return;
    }

    // Хайлт явж байхад хуучин үр дүн харагдсаар байна (бүдгэрч) —
    // хоосон дэлгэц гарахгүй тул хурдан мэдрэгдэнэ
    setLoading(true);
    timerRef.current = setTimeout(() => fetchQuery(activeCat, q), DEBOUNCE_MS);
  }

  function handleCatChange(next: Category) {
    setCat(next);
    setSelGenres([]); // genre-ууд category бүрд өөр тул цэвэрлэнэ
    setGenreMode("and");
    setSort("popularity");
    startSearch(next, query); // одоогийн query-г шинэ таб-аар шууд дахин хайна
  }

  // ---- Browse fetch ----
  const fetchBrowsePage = useCallback(
    async (
      bcat: BrowseCat,
      genres: string[],
      srt: BrowseSort,
      mode: GenreMode,
      page: number,
      append: boolean,
    ) => {
      // Серверийн cache key-тэй ижил бүтэц (mode заавал орно)
      const key = `browse:${bcat}:${srt}:${mode}:${[...genres].sort().join(",")}:${page}`;
      browseKeyRef.current = key;
      setRateLimited(false);

      const apply = (payload: { items: MediaItem[]; hasMore: boolean }) => {
        setBrowsePage(page);
        setBrowseHasMore(payload.hasMore);
        setBrowseItems((prev) => {
          if (!append) return payload.items;
          // Хуудас хооронд давхардсан item (popularity хөдөлсөн үед) хасна
          const seen = new Set(prev.map((i) => i.id));
          return [...prev, ...payload.items.filter((i) => !seen.has(i.id))];
        });
      };

      const cached = lruGet(browseCache, key);
      if (cached) {
        apply(cached);
        setBrowseLoading(false);
        setBrowseAppending(false);
        return;
      }

      browseAbortRef.current?.abort();
      const ac = new AbortController();
      browseAbortRef.current = ac;
      if (append) setBrowseAppending(true);
      else setBrowseLoading(true);

      try {
        const res = await fetch(
          `/api/browse?cat=${bcat}&genres=${encodeURIComponent(genres.join(","))}&sort=${srt}&mode=${mode}&page=${page}`,
          { signal: ac.signal },
        );
        if (res.status === 429) {
          if (browseKeyRef.current === key) {
            setRateLimited(true);
            setBrowseLoading(false);
            setBrowseAppending(false);
          }
          return;
        }
        const json = (await res.json()) as {
          items: MediaItem[];
          hasMore: boolean;
        };
        const payload = { items: json.items ?? [], hasMore: !!json.hasMore };
        lruSet(browseCache, key, payload);
        if (browseKeyRef.current === key) {
          apply(payload);
          setBrowseLoading(false);
          setBrowseAppending(false);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError" && browseKeyRef.current === key) {
          setBrowseLoading(false);
          setBrowseAppending(false);
        }
      }
    },
    [],
  );

  // Browse горимд орох / genre-sort өөрчлөгдөхөд 1-р хуудаснаас шинээр.
  // Жижиг debounce: chip-үүдийг хурдан дараалан toggle хийхэд нэг л fetch явна
  useEffect(() => {
    if (!browseMode) return;
    const t = setTimeout(
      () => fetchBrowsePage(cat as BrowseCat, selGenres, sort, genreMode, 1, false),
      DEBOUNCE_MS,
    );
    return () => clearTimeout(t);
  }, [browseMode, cat, selGenres, sort, genreMode, fetchBrowsePage]);

  const activeTab = CATEGORY_TABS.find((t) => t.cat === cat)!;
  const genreDefs = isBrowseCat(cat) ? BROWSE_GENRES[cat] : [];
  const activeDefs = genreDefs.filter((g) => selGenres.includes(g.slug));

  // Текст хайлттай үед сонгосон genre-үүд client-side шүүнэ (mode-оор)
  const filteredResults =
    activeDefs.length > 0
      ? results.filter((item) =>
          matchesGenres(item.genres, activeDefs, genreMode),
        )
      : results;

  const showSkeletons =
    (query.trim() ? loading && results.length === 0 : browseLoading && browseItems.length === 0);

  const gridSkeletons = (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-x-2 gap-y-3">
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <Skeleton className="rounded-md" style={{ width: 72, height: POSTER_H }} />
          <Skeleton className="h-2.5 w-14 rounded" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="glass rounded-2xl p-3.5">
      {/* Category segmented tabs */}
      <div className="fade-x -mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1">
        {CATEGORY_TABS.map((t) => (
          <button
            key={t.cat}
            type="button"
            onClick={() => handleCatChange(t.cat)}
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              cat === t.cat
                ? "text-primary-foreground"
                : "bg-white/[0.04] text-muted-foreground hover:bg-white/10 hover:text-foreground",
            )}
          >
            {cat === t.cat && (
              <motion.span
                layoutId="cat-tab-pill"
                className="absolute inset-0 rounded-full bg-primary shadow-[0_0_18px_-4px_var(--primary)]"
                transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
              />
            )}
            <t.Icon className="relative z-10 h-3.5 w-3.5" />
            <span className="relative z-10">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="group relative mb-3">
        <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            startSearch(cat, e.target.value);
          }}
          placeholder={activeTab.placeholder}
          className="h-11 rounded-xl border-white/10 bg-black/30 pl-10 text-[15px]"
        />
        {(loading || browseLoading) && (
          <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
        )}
      </div>

      {/* Genre шүүлтүүр + эрэмбэлэлт (browse боломжтой таб дээр) */}
      {genreDefs.length > 0 && (
        <div className="mb-3 flex flex-col gap-2">
          <div className="fade-x -mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
            {genreDefs.map((g) => {
              const active = selGenres.includes(g.slug);
              return (
                <button
                  key={g.slug}
                  type="button"
                  onClick={() =>
                    setSelGenres((prev) =>
                      active
                        ? prev.filter((s) => s !== g.slug)
                        : [...prev, g.slug],
                    )
                  }
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    active
                      ? "border-primary/60 bg-primary/20 text-primary"
                      : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/25 hover:text-foreground",
                  )}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {/* Sort — зөвхөн browse горимд (хайлтад relevance эрэмбэ ялна) */}
            {browseMode && (
              <div className="flex gap-1">
                {SORT_TABS.map((s) => (
                  <button
                    key={s.sort}
                    type="button"
                    onClick={() => setSort(s.sort)}
                    className={cn(
                      "flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors",
                      sort === s.sort
                        ? "bg-primary/20 text-primary"
                        : "bg-white/[0.03] text-muted-foreground hover:bg-white/10 hover:text-foreground",
                    )}
                  >
                    <s.Icon className="h-3 w-3" />
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            {/* AND/OR — 2-оос доош genre сонгосон үед утгагүй тул нуугдана */}
            {selGenres.length >= 2 && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">
                  Genre
                </span>
                <div className="flex rounded-lg bg-white/[0.03] p-0.5">
                  {(
                    [
                      { mode: "and" as const, label: "БА", hint: "бүх genre-т таарсан нь" },
                      { mode: "or" as const, label: "ЭСВЭЛ", hint: "аль нэг genre-т таарсан нь" },
                    ]
                  ).map((m) => (
                    <button
                      key={m.mode}
                      type="button"
                      title={m.hint}
                      onClick={() => setGenreMode(m.mode)}
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[11px] font-bold transition-colors",
                        genreMode === m.mode
                          ? "bg-primary/25 text-primary"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Progress bar — хайлт явж байгааг илтгэнэ */}
      <div className="relative -mt-2 mb-2 h-0.5 overflow-hidden rounded-full">
        {(loading || browseLoading) && <div className="progress-bar absolute inset-0" />}
      </div>

      {/* Үр дүн: босоо grid (доошоо гүйлгэнэ) */}
      <div
        className={cn(
          "transition-opacity duration-300",
          ((loading && results.length > 0) ||
            (browseLoading && browseItems.length > 0)) &&
            "opacity-40",
        )}
        style={{ minHeight: POSTER_H + 34 }}
      >
        {rateLimited ? (
          <p className="px-2 py-4 text-sm text-amber-400/90">
            AniList түр ачаалалтай байна — хэдэн секунд хүлээгээд дахин оролдоно
            уу
          </p>
        ) : showSkeletons ? (
          gridSkeletons
        ) : query.trim() ? (
          filteredResults.length > 0 ? (
            <MediaGrid
              items={filteredResults}
              boardItemIds={boardItemIds}
              watchLaterIds={watchLaterIds}
              selectedId={selectedId}
              showSubtitles={SUBTITLE_CATS.has(cat)}
              onSelect={onSelect}
              onPick={onPick}
              onWatchLater={onWatchLater}
            />
          ) : (
            <p className="px-2 text-sm text-muted-foreground/60">
              {loading
                ? ""
                : activeDefs.length > 0 && results.length > 0
                  ? genreMode === "and" && activeDefs.length >= 2
                    ? "Бүх genre-т таарах үр дүн алга — «ЭСВЭЛ» болгож үзээрэй"
                    : "Сонгосон genre-д таарах үр дүн алга — шүүлтүүрээ цэвэрлээд үзээрэй"
                  : "Үр дүн олдсонгүй"}
            </p>
          )
        ) : browseMode ? (
          <MediaGrid
            items={browseItems}
            boardItemIds={boardItemIds}
            watchLaterIds={watchLaterIds}
            selectedId={selectedId}
            showSubtitles={false}
            onSelect={onSelect}
            onPick={onPick}
            onWatchLater={onWatchLater}
            hasMore={browseHasMore}
            loadingMore={browseAppending}
            onLoadMore={() =>
              fetchBrowsePage(
                cat as BrowseCat,
                selGenres,
                sort,
                genreMode,
                browsePage + 1,
                true,
              )
            }
          />
        ) : (
          <p className="px-2 text-sm text-muted-foreground/60">
            Хайлт хийгээд poster дээр дараад tier-ээ сонгоорой (чирж ч болно) —
            Кино/Сериал/Аниме/Манга таб дээр хайлгүйгээр бүгдийг үзэж болно
          </p>
        )}
      </div>
    </div>
  );
}
