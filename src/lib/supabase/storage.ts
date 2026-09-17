import type { SupabaseClient } from "@supabase/supabase-js";

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

export async function getSignedContentUrl(
  supabase: SupabaseClient,
  storagePath: string | null
): Promise<string | null> {
  if (!storagePath) return null;
  const { data, error } = await supabase.storage
    .from("content")
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data.signedUrl;
}

export function buildUserStoragePath(userId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  return `${userId}/${Date.now()}-${safeName}`;
}
