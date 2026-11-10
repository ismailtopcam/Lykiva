/**
 * Şikayet: supabase/migrations/20261110060000_yonetim.sql > sikayet_et(tur, hedef, neden).
 * Yönetim panelinde (/admin/sikayetler) görünür; şikayet edilen kişi görmez.
 */
import { oturumuSagla, supabase } from '@/lib/supabase';

export type SikayetTuru = 'user' | 'activity' | 'route' | 'message' | 'group' | 'event' | 'comment';

export async function sikayetEt(tur: SikayetTuru, hedef: string, neden: string): Promise<string> {
  await oturumuSagla();
  const { data, error } = await supabase.rpc('sikayet_et', { tur, hedef, neden });
  if (error) throw new Error(error.message);
  return data as string;
}
