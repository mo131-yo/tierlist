"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchPoster, POSTER_H } from "./PosterCard";
import type { Category, MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 350;
const CLIENT_CACHE_MAX = 50; // LRU: үүнээс хэтэрвэл хамгийн хуучин query устгагдана
const VISIBLE_LIMIT = 10; // эхний харагдах үр дүн — илүү нь «see more»-ийн ард

const CATEGORY_TABS: { cat: Category; label: string; placeholder: string }[] = [
  { cat: "all", label: "🔎 Бүгд", placeholder: "Юу ч хай — кино, аниме, дүр, ном, хоол…" },
  { cat: "movie", label: "🎬 Кино", placeholder: "Кино хайх… (ж: interstellar, oppenheimer)" },
  { cat: "tv", label: "📺 Сериал", placeholder: "Сериал хайх… (ж: breaking bad, squid game)" },
  { cat: "season", label: "🎞 Улирал", placeholder: "Сериалын нэрээр хайхад улирал бүр нь гарна… (ж: stranger things)" },
  { cat: "anime", label: "🎌 Аниме", placeholder: "Аниме хайх… (ж: naruto, blue lock)" },
  { cat: "manga", label: "📖 Манга", placeholder: "Манга хайх… (ж: berserk, one piece)" },
  { cat: "character", label: "👤 Дүр", placeholder: "Аниме/мангагийн дүр хайх… (ж: levi, gojo)" },
  { cat: "book", label: "📚 Ном", placeholder: "Ном хайх… (ж: harry potter, dune)" },
  { cat: "wiki", label: "🌐 Бусад", placeholder: "Юу ч хай: хуушуур, ferrari, messi…" },
];

// Эдгээр таб дээр poster доор subtitle гарна (холимог/ижил нэртэй үр дүнг ялгахад)
const SUBTITLE_CATS: ReadonlySet<Category> = new Set(["character", "season", "all"]);

// Session доторх client кэш: `${cat}:${query}` → items. LRU (50 хүртэл).
const clientCache = new Map<string, MediaItem[]>();

function cacheGet(key: string): MediaItem[] | undefined {
  const v = clientCache.get(key);
  if (v) {
    // recency шинэчилнэ: delete + set нь key-г Map-ийн төгсгөлд шилжүүлнэ
    clientCache.delete(key);
    clientCache.set(key, v);
  }
  return v;
}

function cacheSet(key: string, items: MediaItem[]) {
  if (clientCache.size >= CLIENT_CACHE_MAX && !clientCache.has(key)) {
    const oldest = clientCache.keys().next().value;
    if (oldest !== undefined) clientCache.delete(oldest);
  }
  clientCache.set(key, items);
}

export function SearchTray({
  boardItemIds,
  selectedId,
  onSelect,
  onResults,
}: {
  boardItemIds: Set<string>;
  selectedId: string | null;
  onSelect: (item: MediaItem) => void;
  onResults: (items: MediaItem[]) => void;
}) {
  const [cat, setCat] = useState<Category>("all");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [expanded, setExpanded] = useState(false); // see-more дарсан эсэх
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestKey = useRef("");

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    },
    [],
  );

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
      cacheSet(key, items);
      // Stale guard: хариу ирэх хооронд query/cat өөрчлөгдсөн бол render хийхгүй
      if (latestKey.current === key) {
        setResults(items);
        onResults(items);
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
    setExpanded(false); // шинэ хайлт бүрд эхний 10 руу буцна

    // Debounce: завсрын query (n, na, nar...) энд устгагдах тул сервер лүү явдаггүй
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!q) {
      setResults([]);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }

    // Client LRU кэш: агшин зуур, сервер лүү огт явахгүй
    const cached = cacheGet(key);
    if (cached) {
      setResults(cached);
      onResults(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    timerRef.current = setTimeout(() => fetchQuery(activeCat, q), DEBOUNCE_MS);
  }

  function handleCatChange(next: Category) {
    setCat(next);
    startSearch(next, query); // одоогийн query-г шинэ таб-аар шууд дахин хайна
  }

  const activeTab = CATEGORY_TABS.find((t) => t.cat === cat)!;

  return (
    <div className="glass rounded-xl p-3">
      {/* Category tabs */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {CATEGORY_TABS.map((t) => (
          <button
            key={t.cat}
            type="button"
            onClick={() => handleCatChange(t.cat)}
            className={cn(
              "relative rounded-full px-3 py-1 text-xs font-medium transition-colors",
              cat === t.cat
                ? "text-primary-foreground"
                : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground",
            )}
          >
            {cat === t.cat && (
              <motion.span
                layoutId="cat-tab-pill"
                className="absolute inset-0 rounded-full bg-primary"
                transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
              />
            )}
            <span className="relative z-10">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            startSearch(cat, e.target.value);
          }}
          placeholder={activeTab.placeholder}
          className="border-white/10 bg-black/30 pl-9"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      <div
        className="flex items-start gap-1.5 overflow-x-auto pb-1"
        style={{ minHeight: POSTER_H + 8 }}
      >
        {rateLimited ? (
          <p className="px-2 py-4 text-sm text-amber-400/90">
            AniList түр ачаалалтай байна — хэдэн секунд хүлээгээд дахин оролдоно
            уу
          </p>
        ) : loading && results.length === 0 ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Skeleton
              key={i}
              className="shrink-0 rounded-md"
              style={{ width: 72, height: POSTER_H }}
            />
          ))
        ) : results.length > 0 ? (
          <>
            {(expanded ? results : results.slice(0, VISIBLE_LIMIT)).map(
              (item, i) => (
                <div
                  key={item.id}
                  className="pop-in flex w-[72px] shrink-0 flex-col gap-0.5"
                  style={{ animationDelay: `${Math.min(i, 16) * 30}ms` }}
                >
                  <SearchPoster
                    item={item}
                    onBoard={boardItemIds.has(item.id)}
                    selected={selectedId === item.id}
                    onSelect={onSelect}
                  />
                  {SUBTITLE_CATS.has(cat) && item.subtitle && (
                    <span
                      className="truncate text-center text-[9px] leading-tight text-muted-foreground/70"
                      title={item.subtitle}
                    >
                      {item.subtitle}
                    </span>
                  )}
                </div>
              ),
            )}
            {!expanded && results.length > VISIBLE_LIMIT && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="glass flex shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-white/10 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                style={{ width: 72, height: POSTER_H }}
              >
                <span className="text-lg font-bold">
                  +{results.length - VISIBLE_LIMIT}
                </span>
                <span className="text-[10px]">бүгдийг харах</span>
              </button>
            )}
          </>
        ) : (
          <p className="px-2 text-sm text-muted-foreground/60">
            {query.trim()
              ? loading
                ? ""
                : "Үр дүн олдсонгүй"
              : "Хайлт хийгээд poster-оо tier рүү чирээрэй ↑"}
          </p>
        )}
      </div>
    </div>
  );
}
