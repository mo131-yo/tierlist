import {
  pgTable,
  text,
  integer,
  bigint,
  real,
} from "drizzle-orm/pg-core";

// Supabase Postgres (Phase 2). Timestamp-ууд Date.now() миллисекунд тул
// 32-бит integer-т багтахгүй — bigint (mode: number) ашиглана.

export const mediaItems = pgTable("media_items", {
  id: text("id").primaryKey(), // "movie-123" | "tv-456" | "al-a-1" | "book-…" | "wiki-…"
  tmdbId: integer("tmdb_id").notNull(),
  mediaType: text("media_type").notNull(),
  title: text("title").notNull(),
  subtitle: text("subtitle"), // дүрийн харьяа бүтээл гэх мэт; ихэнх төрөлд null
  posterPath: text("poster_path"), // TMDB path эсвэл бусад эх сурвалжийн бүтэн URL
  backdropPath: text("backdrop_path"),
  overview: text("overview").notNull().default(""),
  genres: text("genres").notNull().default("[]"), // JSON: ["Action","Animation"]
  year: text("year"),
  rating: real("rating").notNull().default(0),
  popularity: real("popularity").notNull().default(0),
  refreshedAt: bigint("refreshed_at", { mode: "number" }).notNull(), // ms — category TTL шалгалтад
});

export const searchCache = pgTable("search_cache", {
  query: text("query").primaryKey(), // "{cat}:{normalized query}"
  itemIds: text("item_ids").notNull(), // JSON array, эрэмбэтэй
  createdAt: bigint("created_at", { mode: "number" }).notNull(), // ms
});

// data нь бүтэн JSON blob: {rows:[{id,label,color,itemIds:[]}], tray:[itemId]}
// Autosave бүрд бүтэн blob дахин бичигдэнэ — одоогийн хэмжээнд асуудалгүй.
// Шаардлагатай бол tierRows/tierItems хүснэгт болгож normalize хийж болно;
// тиймээс blob-ийн бүтцийг (rows массив + itemIds) тогтвортой байлгана.
export const tierLists = pgTable("tier_lists", {
  id: text("id").primaryKey(),
  title: text("title").notNull().default("Шинэ Tier List"),
  data: text("data").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export type MediaItemRow = typeof mediaItems.$inferSelect;
export type TierListRow = typeof tierLists.$inferSelect;
