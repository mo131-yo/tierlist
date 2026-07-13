import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

// Phase 2 (Supabase): drizzle-orm/node-postgres + SUPABASE_DB_URL болгож солино.
const globalForDb = globalThis as unknown as { db?: ReturnType<typeof makeDb> };

function makeDb() {
  const client = createClient({
    url: process.env.DATABASE_URL ?? "file:./local.db",
  });
  return drizzle(client, { schema });
}

export const db = globalForDb.db ?? makeDb();
if (process.env.NODE_ENV !== "production") globalForDb.db = db;
