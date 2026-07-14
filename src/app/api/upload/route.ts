import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { supabaseAdmin, CUSTOM_BUCKET } from "@/lib/supabase";
import { db } from "@/db";
import { mediaItems } from "@/db/schema";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

let bucketReady = false;
async function ensureBucket() {
  if (bucketReady) return;
  const sb = supabaseAdmin();
  const { data } = await sb.storage.getBucket(CUSTOM_BUCKET);
  if (!data) {
    await sb.storage.createBucket(CUSTOM_BUCKET, {
      public: true,
      fileSizeLimit: MAX_SIZE,
    });
  }
  bucketReady = true;
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл алга" }, { status: 400 });
  }
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Зөвхөн JPG/PNG/WebP/GIF зураг" },
      { status: 400 },
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "5MB-аас том байна" }, { status: 400 });
  }

  try {
    await ensureBucket();
    const sb = supabaseAdmin();
    const path = `${nanoid(12)}.${ext}`;
    const { error: upErr } = await sb.storage
      .from(CUSTOM_BUCKET)
      .upload(path, await file.arrayBuffer(), {
        contentType: file.type,
        cacheControl: "31536000",
      });
    if (upErr) throw upErr;

    const { data: pub } = sb.storage.from(CUSTOM_BUCKET).getPublicUrl(path);
    const title =
      file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Өөрийн зураг";
    const item = {
      id: `custom-${nanoid(10)}`,
      tmdbId: 0,
      mediaType: "custom",
      title,
      subtitle: null as string | null,
      posterPath: pub.publicUrl,
      backdropPath: null as string | null,
      overview: "",
      genres: "[]",
      year: null as string | null,
      rating: 0,
      popularity: 0,
      refreshedAt: Date.now(),
    };
    await db.insert(mediaItems).values(item);

    return NextResponse.json({
      item: { ...item, genres: [] as string[] },
    });
  } catch (err) {
    console.error("[upload] failed:", err);
    return NextResponse.json({ error: "Upload амжилтгүй" }, { status: 500 });
  }
}
