import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Supabase transaction pooler (порт 6543) prepared statement дэмждэггүй тул
// prepare: false заавал хэрэгтэй. Serverless дээр холболт цөөн байлгана.
const globalForDb = globalThis as unknown as { db?: ReturnType<typeof makeDb> };

function makeDb() {
  const client = postgres(process.env.DATABASE_URL!, {
    prepare: false,
    max: 5,
  });
  return drizzle(client, { schema });
}

export const db = globalForDb.db ?? makeDb();
if (process.env.NODE_ENV !== "production") globalForDb.db = db;
