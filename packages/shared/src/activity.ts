/** Desteklenen aktivite türleri — veritabanındaki `activity_type` enum'u ile aynı */
export const ACTIVITY_TYPES = ['bike', 'mtb', 'run', 'walk', 'hike', 'trail_run'] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  bike: 'Bisiklet',
  mtb: 'Dağ bisikleti',
  run: 'Koşu',
  walk: 'Yürüyüş',
  hike: 'Doğa yürüyüşü',
  trail_run: 'Patika koşusu',
};

/** Kim görebilir — aktivite, rota ve etkinlikler için ortak */
export const VISIBILITY = ['private', 'followers', 'groups', 'public'] as const;
export type Visibility = (typeof VISIBILITY)[number];
