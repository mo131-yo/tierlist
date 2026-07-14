import { toast } from "sonner";
import type { MediaItem } from "@/lib/types";

/** Зургийн файлуудыг /api/upload руу дараалан илгээнэ (глобал drop + tray хоёул ашиглана) */
export async function uploadImageFiles(
  files: FileList | File[],
  onItem: (item: MediaItem) => void,
  onCountChange?: (delta: number) => void,
): Promise<void> {
  const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
  if (list.length === 0) return;
  onCountChange?.(list.length);
  for (const file of list) {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = (await res.json()) as { item?: MediaItem; error?: string };
      if (!res.ok || !json.item) throw new Error(json.error ?? "Upload амжилтгүй");
      onItem(json.item);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      onCountChange?.(-1);
    }
  }
}
