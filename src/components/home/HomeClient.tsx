"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Plus, Trash2, Loader2, Clapperboard, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getPosterUrl } from "@/lib/imageStore";
import { ShareMenu } from "@/components/ShareMenu";

gsap.registerPlugin(useGSAP);

export interface HomeListItem {
  id: string;
  title: string;
  updatedAt: number;
  itemCount: number;
  posters: string[];
}

/** Дэвсгэрийн 2 эгнээ эсрэг чиглэлийн poster marquee (Ten Years Away маягийн texture) */
function PosterMarquee({ posters }: { posters: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const rows = [posters.slice(0, 15), posters.slice(15, 30)];

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.utils
          .toArray<HTMLElement>(".marquee-track")
          .forEach((track, i) => {
            gsap.to(track, {
              xPercent: i % 2 === 0 ? -50 : 50,
              duration: 70 + i * 15,
              ease: "none",
              repeat: -1,
            });
          });
      });
    },
    { scope: ref },
  );

  if (posters.length < 6) return null;
  return (
    <div
      ref={ref}
      aria-hidden
      className="marquee-mask pointer-events-none absolute inset-x-0 top-0 z-0 flex h-72 flex-col justify-center gap-3 overflow-hidden opacity-25 blur-[1.5px]"
    >
      {rows.map((row, i) => (
        <div
          key={i}
          className={`marquee-track flex w-max gap-3 ${i % 2 === 1 ? "-translate-x-1/2" : ""}`}
        >
          {/* 2 давхар — үзүүр залгагдаж тасралтгүй гүйнэ */}
          {[...row, ...row].map((p, j) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={j}
              src={getPosterUrl(p, "w185")!}
              alt=""
              loading={j < 8 ? "eager" : "lazy"}
              className="h-32 w-[86px] shrink-0 rounded-md object-cover"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function HomeClient({
  lists,
  marqueePosters,
}: {
  lists: HomeListItem[];
  marqueePosters: string[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<HomeListItem | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const magneticRef = useRef<HTMLDivElement>(null);

  // Hero + card-уудын кинетик орох animation (TRIONN маягийн char stagger)
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
        tl.from(".hero-char", {
          yPercent: 120,
          rotate: 6,
          opacity: 0,
          duration: 0.9,
          stagger: 0.045,
        })
          .from(
            ".hero-sub",
            { y: 16, opacity: 0, duration: 0.6 },
            "-=0.45",
          )
          .from(
            ".hero-cta",
            { y: 14, opacity: 0, scale: 0.94, duration: 0.5 },
            "-=0.35",
          )
          .from(
            ".list-card",
            { y: 32, opacity: 0, duration: 0.6, stagger: 0.07 },
            "-=0.25",
          );
      });
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(".hero-char,.hero-sub,.hero-cta,.list-card", { clearProps: "all" });
      });
    },
    { scope: rootRef },
  );

  // Magnetic CTA товч (hover-т cursor руу зөөлөн татагдана)
  useGSAP(
    () => {
      const el = magneticRef.current;
      if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        return;
      const xTo = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3.out" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3.out" });
      const move = (e: MouseEvent) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.3);
        yTo((e.clientY - r.top - r.height / 2) * 0.3);
      };
      const leave = () => {
        xTo(0);
        yTo(0);
      };
      el.addEventListener("mousemove", move);
      el.addEventListener("mouseleave", leave);
      return () => {
        el.removeEventListener("mousemove", move);
        el.removeEventListener("mouseleave", leave);
      };
    },
    { scope: rootRef },
  );

  // Card-ын 3D tilt + glow координат
  function handleCardMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);
    gsap.to(el, {
      rotateY: (px - 0.5) * 8,
      rotateX: (0.5 - py) * 8,
      transformPerspective: 800,
      duration: 0.35,
      ease: "power2.out",
    });
  }
  function handleCardLeave(e: React.MouseEvent<HTMLDivElement>) {
    gsap.to(e.currentTarget, {
      rotateX: 0,
      rotateY: 0,
      duration: 0.5,
      ease: "power3.out",
    });
  }

  async function createList() {
    setCreating(true);
    try {
      const res = await fetch("/api/tierlists", { method: "POST" });
      const json = (await res.json()) as { list: { id: string } };
      router.push(`/t/${json.list.id}`);
    } catch {
      toast.error("Үүсгэж чадсангүй");
      setCreating(false);
    }
  }

  async function deleteList(id: string) {
    await fetch(`/api/tierlists/${id}`, { method: "DELETE" });
    setDeleting(null);
    router.refresh();
    toast.success("Устгагдлаа");
  }

  const heroChars = "CineTier".split("");

  return (
    <main
      ref={rootRef}
      className="relative mx-auto w-full max-w-5xl flex-1 px-6 pb-16 pt-10"
    >
      <PosterMarquee posters={marqueePosters} />

      {/* Hero */}
      <div className="relative z-10 mb-12 flex flex-col items-center pt-16 text-center">
        <h1
          className="flex overflow-hidden text-6xl font-black tracking-tight sm:text-7xl"
          aria-label="CineTier"
        >
          {heroChars.map((c, i) => (
            <span
              key={i}
              className={`hero-char inline-block ${i >= 4 ? "text-primary" : ""}`}
            >
              {c}
            </span>
          ))}
        </h1>
        <p className="hero-sub mt-3 max-w-md text-balance text-muted-foreground">
          Кино · аниме · дүр · ном · юу ч бай — хайгаад л чирээд л tier list-ээ
          хий.
        </p>
        <div ref={magneticRef} className="hero-cta mt-7">
          <Button size="lg" onClick={createList} disabled={creating}>
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Шинэ Tier List
          </Button>
        </div>
      </div>

      {/* Lists */}
      {lists.length === 0 ? (
        <div className="list-card glass relative z-10 flex flex-col items-center gap-4 rounded-2xl py-20 text-center text-muted-foreground">
          <Clapperboard className="h-12 w-12 opacity-40" />
          <p>
            Одоогоор tier list алга.
            <br />
            Дээрх товчоор эхнийхээ жагсаалтыг үүсгээрэй!
          </p>
        </div>
      ) : (
        <div
          className="relative z-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          style={{ perspective: 1000 }}
        >
          {lists.map((l) => (
            <div
              key={l.id}
              className="list-card glow-card glass group relative cursor-pointer overflow-hidden rounded-2xl will-change-transform"
              onClick={() => router.push(`/t/${l.id}`)}
              onMouseMove={handleCardMove}
              onMouseLeave={handleCardLeave}
            >
              {/* Poster collage preview */}
              <div className="flex h-36 overflow-hidden">
                {l.posters.length > 0 ? (
                  l.posters.map((p, idx) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={idx}
                      src={getPosterUrl(p, "w185")!}
                      alt=""
                      className="h-full min-w-0 flex-1 object-cover transition-transform duration-500 group-hover:scale-108"
                    />
                  ))
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-black/20 text-muted-foreground/30">
                    <Clapperboard className="h-10 w-10" />
                  </div>
                )}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-linear-to-t from-[oklch(0.17_0.014_270)] via-transparent to-transparent" />
              </div>

              <div className="flex items-center justify-between gap-2 p-4">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{l.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {l.itemCount} item · {formatDate(l.updatedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  <ShareMenu
                    url={`/t/${l.id}`}
                    title={l.title}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Хуваалцах"
                        className="text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Устгах"
                    className="text-muted-foreground opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleting(l);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tier list устгах уу?</DialogTitle>
            <DialogDescription>
              «{deleting?.title}» бүрмөсөн устана.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Болих
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleting && deleteList(deleting.id)}
            >
              Устгах
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

// Locale-аас хамааралгүй тогтмол формат — hydration mismatch үүсгэхгүй
function formatDate(ms: number) {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}
