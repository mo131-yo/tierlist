import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// Phase 2 (Supabase): энэ файлыг drizzle-orm/pg-core руу хөрвүүлэхэд л хангалттай —
// бүх query src/db/queries.ts дотор төвлөрсөн тул route-ууд өөрчлөгдөхгүй.

export const mediaItems = sqliteTable("media_items", {
  id: text("id").primaryKey(), // "movie-123" | "tv-456"
  tmdbId: integer("tmdb_id").notNull(),
  mediaType: text("media_type").notNull(), // movie | tv
  title: text("title").notNull(),
  subtitle: text("subtitle"), // дүрийн харьяа бүтээл гэх мэт; ихэнх төрөлд null
  posterPath: text("poster_path"), // TMDB path эсвэл бусад эх сурвалжийн бүтэн URL
  backdropPath: text("backdrop_path"),
  overview: text("overview").notNull().default(""),
  genres: text("genres").notNull().default("[]"), // JSON: ["Action","Animation"]
  year: text("year"),
  rating: real("rating").notNull().default(0),
  popularity: real("popularity").notNull().default(0),
  refreshedAt: integer("refreshed_at").notNull(), // ms — 7 хоногийн TTL шалгалтад
});

export const searchCache = sqliteTable("search_cache", {
  query: text("query").primaryKey(), // normalize: lowercase + trim
  itemIds: text("item_ids").notNull(), // JSON array, эрэмбэтэй
  createdAt: integer("created_at").notNull(), // ms
});

// data нь бүтэн JSON blob: {rows:[{id,label,color,itemIds:[]}], tray:[itemId]}
// Autosave бүрд бүтэн blob дахин бичигдэнэ — Phase 1-ийн хэмжээнд асуудалгүй.
// Phase 2-т шаардлагатай бол tierRows/tierItems хүснэгт болгож normalize хийнэ;
// тиймээс blob-ийн бүтцийг (rows массив + itemIds) тогтвортой байлгана.
export const tierLists = sqliteTable("tier_lists", {
  id: text("id").primaryKey(),
  title: text("title").notNull().default("Шинэ Tier List"),
  data: text("data").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export type MediaItemRow = typeof mediaItems.$inferSelect;
export type TierListRow = typeof tierLists.$inferSelect;
