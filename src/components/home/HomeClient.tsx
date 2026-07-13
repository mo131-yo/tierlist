"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Trash2, Loader2, Clapperboard } from "lucide-react";
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

// Locale-аас хамааралгүй тогтмол формат — сервер/browser дээр ижил гарч
// hydration mismatch үүсгэхгүй
function formatDate(ms: number) {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

export interface HomeListItem {
  id: string;
  title: string;
  updatedAt: number;
  itemCount: number;
  posters: string[];
}

export function HomeClient({ lists }: { lists: HomeListItem[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<HomeListItem | null>(null);

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

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-10 flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="flex items-center gap-3 text-4xl font-extrabold tracking-tight">
            <Clapperboard className="h-9 w-9 text-primary" />
            CineTier
          </h1>
          <p className="mt-2 text-muted-foreground">
            Кино, аниме, сериалаа хайгаад л tier list-ээ хий — poster автоматаар
            татагдана.
          </p>
        </div>
        <Button size="lg" onClick={createList} disabled={creating}>
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Шинэ Tier List
        </Button>
      </motion.div>

      {lists.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="glass flex flex-col items-center gap-4 rounded-2xl py-20 text-center text-muted-foreground"
        >
          <Clapperboard className="h-12 w-12 opacity-40" />
          <p>
            Одоогоор tier list алга.
            <br />
            Дээрх товчоор эхнийхээ жагсаалтыг үүсгээрэй!
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((l, i) => (
            <motion.div
              key={l.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.35 }}
              whileHover={{ y: -4 }}
              className="glass group relative cursor-pointer overflow-hidden rounded-2xl"
              onClick={() => router.push(`/t/${l.id}`)}
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
                      className="h-full min-w-0 flex-1 object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ))
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-black/20 text-muted-foreground/30">
                    <Clapperboard className="h-10 w-10" />
                  </div>
                )}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-t from-[oklch(0.17_0.014_270)] via-transparent to-transparent" />
              </div>

              <div className="flex items-center justify-between gap-2 p-4">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{l.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {l.itemCount} item · {formatDate(l.updatedAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleting(l);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
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
