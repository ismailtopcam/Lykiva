/**
 * Örnek veriler — 2. aşamada ekranları gerçek görünümde göstermek için.
 * Kişiler ve sayılar uydurmadır; 3. aşamada Supabase'ten gelen verilerle değişecek.
 * Koordinatlar [boylam, enlem] (GeoJSON sırası).
 */
import type { ActivityType, HavaDurumu } from '@lykiva/shared';

export type LngLat = [number, number];
export type AvatarTone = 'sea' | 'terra' | 'sand' | 'green' | 'ink';

export type Person = { id: string; name: string; short: string; initials: string; tone: AvatarTone };

export const people: Record<string, Person> = {
  me: { id: 'me', name: 'Ege Demir', short: 'Ege', initials: 'ED', tone: 'sea' },
  ayse: { id: 'ayse', name: 'Ayşe Yılmaz', short: 'Ayşe', initials: 'AY', tone: 'green' },
  mert: { id: 'mert', name: 'Mert Kaya', short: 'Mert', initials: 'MK', tone: 'sea' },
  deniz: { id: 'deniz', name: 'Deniz Erdem', short: 'Deniz', initials: 'DE', tone: 'terra' },
  zeynep: { id: 'zeynep', name: 'Zeynep Öztürk', short: 'Zeynep', initials: 'ZÖ', tone: 'sand' },
  can: { id: 'can', name: 'Can Aydın', short: 'Can', initials: 'CA', tone: 'sand' },
};

/** Kaş – Kalkan sahil yolu (yaklaşık) */
export const kasKalkanRoute: LngLat[] = [
  [29.6386, 36.2018],
  [29.6201, 36.2046],
  [29.6012, 36.2088],
  [29.5798, 36.2165],
  [29.5605, 36.2201],
  [29.5409, 36.2265],
  [29.5221, 36.2338],
  [29.5034, 36.2402],
  [29.4842, 36.2459],
  [29.4643, 36.2511],
  [29.4417, 36.2566],
  [29.4152, 36.2641],
];

/** Faralya – Kabak patikası (yaklaşık) */
export const faralyaKabakRoute: LngLat[] = [
  [29.1352, 36.4945],
  [29.1331, 36.4881],
  [29.1302, 36.4826],
  [29.1318, 36.4772],
  [29.1291, 36.4716],
  [29.1270, 36.4663],
  [29.1251, 36.4611],
];

export type Stop = { n: number; title: string; time: string; km: string; duration: string; note: string; at: number; coord?: LngLat; /** sunucudaki mola kimliği */ id?: string; /** mola kovasındaki fotoğraf yolları */ fotolar?: string[] };

export type BirlikteKisi = { id: string | null; ad: string; kisa: string; kullanici: string; me?: boolean };

export type Activity = {
  id: string;
  owner: string;
  with: string[];
  title: string;
  type: ActivityType;
  place: string;
  when: string;
  distanceKm: string;
  durationMoving: string;
  durationTotal: string;
  climbM: number;
  descentM: number;
  maxElevationM: number;
  avgSpeed: string;
  maxSpeed: string;
  minSpeed: string;
  route: LngLat[];
  elevation: number[];
  speed: number[];
  stops: Stop[];
  likes: number;
  comments: number;
  /** Başlangıç / bitiş saati ve toplam mola (hız sayfası için) */
  startClock: string;
  endClock: string;
  stopTotal: string;
  /** Cihaz rakım verdi mi (vermediyse yükseklik bölümü gizlenir) */
  hasElevation?: boolean;
  /** Giriş yapan kullanıcının kendi aktivitesi mi (sunucudaki) */
  mine?: boolean;
  /** Sunucudaki sahibinin kimliği ve adı (başkasının aktivitesinde kişi sayfasına bağlantı) */
  ownerId?: string;
  ownerName?: string;
  /** Kayıt başındaki hava (yoksa gösterilmez) */
  hava?: HavaDurumu | null;
  /** Sunucudaki aktivitede birlikte yapılan kişiler (with alanı bunların kullanıcı adları) */
  birlikte?: BirlikteKisi[];
  /** 3B görünüm için yükseklikli iz [boylam, enlem, yükseklik | null] */
  iz3b?: [number, number, number | null][];
  /** Mesafeye göre hız (km/sa): 3B sayfasında imlecin altındaki hız */
  hizProfili?: { d: number; v: number }[];
  /** Lykiva'da kimler görür */
  visibility?: 'private' | 'followers' | 'groups' | 'public';
  /** Başkalarına gösterilen izde başlangıç/bitiş gizli mi */
  hideEndpoints?: boolean;
};

export const kasKalkan: Activity = {
  id: 'ornek',
  owner: 'ayse',
  with: ['mert', 'deniz', 'can'],
  title: 'Kaş – Kalkan sahil yolu',
  type: 'bike',
  place: 'Kaş, Antalya',
  when: 'Cumartesi, 7 Kasım · 08:12',
  distanceKm: '27,4',
  durationMoving: '1:38:20',
  durationTotal: '1:56:05',
  climbM: 412,
  descentM: 398,
  maxElevationM: 236,
  avgSpeed: '16,7',
  maxSpeed: '48,2',
  minSpeed: '6,1',
  route: kasKalkanRoute,
  elevation: [4, 40, 95, 88, 120, 180, 236, 170, 110, 60, 22],
  speed: [18, 22, 14, 26, 0, 12, 8, 10, 0, 44, 30, 20, 16],
  stops: [
    { n: 1, title: 'Kaputaş üstü seyir noktası', time: '09:02', km: '8,4', duration: '12:30', note: 'fotoğraf molası', at: 0.31 },
    { n: 2, title: 'Yokuş başı çeşme', time: '09:48', km: '18,1', duration: '4:50', note: 'su molası', at: 0.66 },
  ],
  likes: 24,
  comments: 6,
  startClock: '08:12',
  endClock: '10:08',
  stopTotal: '17:45',
};

export const myActivities = [
  { id: 'ornek', title: 'Kaş – Kalkan sahil yolu', meta: 'Cumartesi · Bisiklet · 3 kişiyle', stats: '27,4 km · 1:38 · 412 m', route: kasKalkanRoute },
  { id: 'saklikent', title: 'Saklıkent kanyon üstü', meta: 'Çarşamba · Doğa yürüyüşü', stats: '11,8 km · 3:05 · 610 m', route: faralyaKabakRoute },
];

export const weekKm = [
  { day: 'Pzt', km: 9.2 },
  { day: 'Sal', km: 0 },
  { day: 'Çar', km: 11.8 },
  { day: 'Per', km: 0 },
  { day: 'Cum', km: 5.4 },
  { day: 'Cmt', km: 27.4 },
  { day: 'Paz', km: 0 },
];

export type LiveFriend = {
  person: string;
  activity: string;
  detail: string;
  label: string;
  coord: LngLat;
  paused?: boolean;
};

export const liveFriends: LiveFriend[] = [
  { person: 'mert', activity: 'Bisiklet', detail: 'Kaş → Patara · 14,2 km · 0:41', label: '22 km/sa', coord: [29.5409, 36.2265] },
  { person: 'deniz', activity: 'Koşu', detail: 'Sahil parkuru · 6,8 km · 0:35', label: '5:12 /km', coord: [29.6012, 36.2088] },
  { person: 'zeynep', activity: 'Doğa yürüyüşü', detail: "12 dk'dır molada", label: 'molada', coord: [29.5560, 36.2330], paused: true },
];

export const groups = [
  { id: 'ornek', name: 'Pedal Kaş', short: 'PK', meta: 'Bisiklet grubu · 12 üye · Özel', tone: 'sea' as AvatarTone, unread: 3 },
  { id: 'likya', name: 'Likya Yolu Yürüyüşçüleri', short: 'LY', meta: 'Topluluk · 2,4 B üye', tone: 'ink' as AvatarTone, unread: 0 },
  { id: 'cumartesi', name: 'Cumartesi Koşucuları', short: 'CK', meta: 'Grup · 8 üye', tone: 'terra' as AvatarTone, unread: 0 },
];

export const communities = [
  { id: 'likya', name: 'Likya Yolu Yürüyüşçüleri', short: 'LY', meta: 'Doğa yürüyüşü · 2,4 B üye · Herkese açık', tone: 'ink' as AvatarTone, state: 'member' as const },
  { id: 'gravel', name: 'Antalya Gravel', short: 'AG', meta: 'Bisiklet · 860 üye · Herkese açık', tone: 'terra' as AvatarTone, state: 'join' as const },
  { id: 'sahil', name: 'Sahil Koşu Kulübü', short: 'SK', meta: 'Koşu · 312 üye · Onaylı katılım', tone: 'sea' as AvatarTone, state: 'request' as const },
];

export const events = [
  { id: 'ornek', title: 'Gün doğumu sürüşü', month: 'KAS', day: '14', when: 'Cmt 06:45 · Pedal Kaş', stats: '32 km · ↑ 450 m', going: 9, capacity: 15 },
  { id: 'kabak', title: 'Kabak patikası yürüyüşü', month: 'KAS', day: '15', when: 'Paz 08:00 · Likya Yolu', stats: '7,2 km · ↑ 380 m', going: 21, capacity: 30 },
];

export const faralyaKabak = {
  id: 'ornek',
  title: 'Faralya – Kabak patikası',
  by: 'Likya Yolu Yürüyüşçüleri paylaştı · Fethiye, Muğla',
  difficulty: 'Orta zorluk',
  type: 'Doğa yürüyüşü',
  direction: 'Tek yön',
  distanceKm: '7,2',
  climbM: 380,
  avgTime: '2 sa 40',
  doneBy: 1284,
  friendsDone: ['deniz', 'can'],
  notes: "3. km'de içme suyu var. Kabak inişi taşlık, sopa önerilir. Yazın gölge az, erken başlayın.",
  elevation: [210, 190, 150, 120, 140, 190, 240, 255, 230, 180, 170],
  route: faralyaKabakRoute,
};

export type Message =
  | { kind: 'text'; from: string; text: string }
  | { kind: 'route'; from: string; title: string; stats: string }
  | { kind: 'poll'; from: string; question: string; options: { label: string; votes: number }[] };

export const groupMessages: Message[] = [
  { kind: 'route', from: 'mert', title: 'Kaş – Patara sahil turu', stats: '44 km · ↑ 610 m · Rota' },
  { kind: 'text', from: 'mert', text: "Haftaya bunu yapalım mı? Patara'da kahvaltı molası verelim." },
  { kind: 'poll', from: 'deniz', question: 'Hangi gün?', options: [{ label: 'Cumartesi', votes: 7 }, { label: 'Pazar', votes: 3 }] },
];
