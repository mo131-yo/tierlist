// Supabase server client (Storage upload-д) — secret key зөвхөн сервер талд.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const CUSTOM_BUCKET = "custom-images";

const globalForSb = globalThis as unknown as { sb?: SupabaseClient };

export function supabaseAdmin(): SupabaseClient {
  if (globalForSb.sb) return globalForSb.sb;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SECRET_KEY .env-д алга");
  const sb = createClient(url, key, { auth: { persistSession: false } });
  if (process.env.NODE_ENV !== "production") globalForSb.sb = sb;
  return sb;
}

/** image-proxy whitelist-д Supabase host-ыг нэмэхэд ашиглана */
export function supabaseHost(): string | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    return url ? new URL(url).hostname : null;
  } catch {
    return null;
  }
}
