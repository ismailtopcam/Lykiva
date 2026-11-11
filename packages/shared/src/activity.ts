import { aktifDil, dileGoreTablo, type Dil } from './dil';

/** Desteklenen aktivite türleri — veritabanındaki `activity_type` enum'u ile aynı */
export const ACTIVITY_TYPES = ['bike', 'mtb', 'run', 'walk', 'hike', 'trail_run'] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

const ACTIVITY_SOZLUK: Record<Dil, Record<ActivityType, string>> = {
  tr: { bike: 'Bisiklet', mtb: 'Dağ bisikleti', run: 'Koşu', walk: 'Yürüyüş', hike: 'Doğa yürüyüşü', trail_run: 'Patika koşusu' },
  en: { bike: 'Cycling', mtb: 'Mountain biking', run: 'Running', walk: 'Walking', hike: 'Hiking', trail_run: 'Trail running' },
  de: { bike: 'Radfahren', mtb: 'Mountainbiken', run: 'Laufen', walk: 'Gehen', hike: 'Wandern', trail_run: 'Traillauf' },
  ru: { bike: 'Велосипед', mtb: 'Маунтинбайк', run: 'Бег', walk: 'Ходьба', hike: 'Пеший поход', trail_run: 'Трейлраннинг' },
};

/** Telefonda o anki dilde; web sunucusunda activityLabel(t, dil) kullan */
export const ACTIVITY_LABELS: Record<ActivityType, string> = dileGoreTablo(ACTIVITY_SOZLUK);

export function activityLabel(type: ActivityType, dil: Dil = aktifDil()): string {
  return ACTIVITY_SOZLUK[dil][type] ?? ACTIVITY_SOZLUK.tr[type];
}

/** Kim görebilir — aktivite, rota ve etkinlikler için ortak */
export const VISIBILITY = ['private', 'followers', 'groups', 'public'] as const;
export type Visibility = (typeof VISIBILITY)[number];
