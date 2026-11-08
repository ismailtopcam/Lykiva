/**
 * Çevrimdışı gönderim kuyruğu: dağda internet yoksa kayıt telefonda bekler,
 * bağlantı gelince (uygulama açıldığında / öne geldiğinde) gönderilir.
 * Sunucu client_id ile çift kaydı engeller, tekrar göndermek güvenlidir.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { oturumuSagla, supabase, supabaseHazir } from '@/lib/supabase';
import type { KayitPaketi } from './paket';

const KUYRUK = 'lykiva.kuyruk.v1';
const GONDERILEN = 'lykiva.gonderilen.v1';

async function oku<T>(key: string, bos: T): Promise<T> {
  try {
    const s = await AsyncStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : bos;
  } catch {
    return bos;
  }
}

export async function kuyruktakiler(): Promise<KayitPaketi[]> {
  return oku<KayitPaketi[]>(KUYRUK, []);
}

export async function kuyrugaEkle(p: KayitPaketi) {
  const list = await kuyruktakiler();
  if (!list.some((x) => x.client_id === p.client_id)) list.push(p);
  await AsyncStorage.setItem(KUYRUK, JSON.stringify(list));
}

/** client_id → sunucudaki aktivite id */
export async function sunucuIdsi(clientId: string): Promise<string | null> {
  const map = await oku<Record<string, string>>(GONDERILEN, {});
  return map[clientId] ?? null;
}

export async function yereldekiPaket(clientId: string): Promise<KayitPaketi | null> {
  return (await kuyruktakiler()).find((p) => p.client_id === clientId) ?? null;
}

let calisiyor: Promise<number> | null = null;

/** Bekleyenleri gönderir; kalan sayısını döner */
export function kuyruguGonder(): Promise<number> {
  if (!calisiyor) {
    calisiyor = gonder().finally(() => {
      calisiyor = null;
    });
  }
  return calisiyor;
}

async function gonder(): Promise<number> {
  const list = await kuyruktakiler();
  if (!list.length || !supabaseHazir) return list.length;
  await oturumuSagla();
  const kalan: KayitPaketi[] = [];
  const map = await oku<Record<string, string>>(GONDERILEN, {});
  for (const p of list) {
    const { data, error } = await supabase.rpc('kaydet_aktivite', { p });
    if (error || typeof data !== 'string') {
      kalan.push(p);
      if (__DEV__) console.warn('[kuyruk] gönderilemedi', error?.message);
    } else {
      map[p.client_id] = data;
    }
  }
  await AsyncStorage.setItem(GONDERILEN, JSON.stringify(map));
  await AsyncStorage.setItem(KUYRUK, JSON.stringify(kalan));
  return kalan.length;
}
