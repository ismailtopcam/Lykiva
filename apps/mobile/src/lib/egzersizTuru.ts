/**
 * Egzersiz türü seçimi: Harita sekmesindeki Egzersiz şeridi, "Tüm egzersizler" ekranı ve rotayla başlat ekranı
 * aynı seçimi kullanır; seçim ve şeridin sırası telefonda saklanır.
 *
 * Şeritte en son başlatılan tür başta durur. Sıra yalnızca kayıt başlatılınca değişir: tür seçerken şerit
 * parmağın altında yer değiştirmesin. Tür sayısı arttıkça şerit uzar, hepsi "Tüm egzersizler"de gruplu görünür.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACTIVITY_TYPES, type ActivityType } from '@lykiva/shared';
import { useSyncExternalStore } from 'react';

import type { IconName } from '@/components/Icon';

const ANAHTAR = 'lykiva.egzersiz-turu.v1';

export const TUR_IKONLARI: Record<ActivityType, IconName> = {
  bike: 'bike',
  mtb: 'bike',
  run: 'run',
  walk: 'walk',
  hike: 'mountain',
  trail_run: 'mountain',
  historic_hike: 'antik',
};

/** "Tüm egzersizler" ekranındaki gruplar. Yeni tür eklenince buraya da yazılmalı (yazılmazsa TypeScript hatası) */
export type TurGrubu = 'bisiklet' | 'kosu';
export const TUR_GRUPLARI: TurGrubu[] = ['bisiklet', 'kosu'];
const GRUP: Record<ActivityType, TurGrubu> = {
  bike: 'bisiklet',
  mtb: 'bisiklet',
  run: 'kosu',
  trail_run: 'kosu',
  walk: 'kosu',
  hike: 'kosu',
  historic_hike: 'kosu',
};

export function grubunTurleri(g: TurGrubu): ActivityType[] {
  return ACTIVITY_TYPES.filter((t) => GRUP[t] === g);
}

type Durum = { secili: ActivityType; sira: ActivityType[] };

let durum: Durum = { secili: 'bike', sira: [...ACTIVITY_TYPES] };
let yuklendi = false;

const dinleyiciler = new Set<() => void>();

function turMu(t: unknown): t is ActivityType {
  return typeof t === 'string' && (ACTIVITY_TYPES as readonly string[]).includes(t);
}

/** Saklanan sırada artık olmayan türleri atar, sonradan eklenen türleri sona koyar */
function tamamla(sira: unknown): ActivityType[] {
  const eski = Array.isArray(sira) ? sira.filter(turMu) : [];
  const tekil = eski.filter((t, i) => eski.indexOf(t) === i);
  return [...tekil, ...ACTIVITY_TYPES.filter((t) => !tekil.includes(t))];
}

function ayarla(yeni: Durum, sakla = true) {
  durum = yeni;
  dinleyiciler.forEach((f) => f());
  if (sakla) void AsyncStorage.setItem(ANAHTAR, JSON.stringify(yeni)).catch(() => undefined);
}

async function yukle() {
  if (yuklendi) return;
  yuklendi = true;
  try {
    const s = await AsyncStorage.getItem(ANAHTAR);
    if (!s) return;
    const j = JSON.parse(s) as Partial<Durum>;
    const sira = tamamla(j.sira);
    ayarla({ secili: turMu(j.secili) ? j.secili : sira[0], sira }, false);
  } catch {
    // Bozuk kayıt: varsayılanla devam
  }
}

function abone(f: () => void) {
  dinleyiciler.add(f);
  void yukle();
  return () => {
    dinleyiciler.delete(f);
  };
}

/** Seçili tür ve şeridin sırası; değişince bileşeni yeniden çizer */
export function useEgzersizTuru(): Durum {
  return useSyncExternalStore(abone, () => durum, () => durum);
}

export function egzersizTuruSec(t: ActivityType) {
  if (t !== durum.secili) ayarla({ ...durum, secili: t });
}

/** Kayıt bu türle başlatıldı: şeritte başa gelir */
export function egzersizBaslatildi(t: ActivityType) {
  ayarla({ secili: t, sira: [t, ...durum.sira.filter((x) => x !== t)] });
}
