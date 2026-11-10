/**
 * Supabase sunucu ayarları (web sunucusunda; tarayıcıya gitmez).
 * Coolify > web uygulaması > Environment Variables:
 *   SUPABASE_URL       (varsayılan https://api.lykiva.app)
 *   SUPABASE_ANON_KEY  (lykiva-supabase servisindeki SERVICE_SUPABASEANON_KEY)
 */
export function supabaseAyari(): { url: string; anahtar: string } | null {
  const anahtar = process.env.SUPABASE_ANON_KEY;
  if (!anahtar) return null;
  return { url: (process.env.SUPABASE_URL || 'https://api.lykiva.app').replace(/\/$/, ''), anahtar };
}
