export type AdminSection = {
  slug: string;
  href: string;
  label: string;
  /** Bu sayfada ileride ne olacak */
  plan: string[];
};

export const adminSections: AdminSection[] = [
  {
    slug: 'genel',
    href: '/admin',
    label: 'Genel bakış',
    plan: [
      'Günlük / haftalık aktif kullanıcı, yeni kayıt, kaydedilen aktivite sayıları',
      'Son şikayetler ve bekleyen moderasyon işleri',
      'Sistem durumu (veritabanı, bildirim servisi)',
    ],
  },
  {
    slug: 'kullanicilar',
    href: '/admin/kullanicilar',
    label: 'Kullanıcılar',
    plan: ['Arama ve filtreleme', 'Profil detayı, aktiviteleri, grupları', 'Askıya alma / engelleme, rol atama'],
  },
  {
    slug: 'aktiviteler',
    href: '/admin/aktiviteler',
    label: 'Aktiviteler',
    plan: ['Tür, tarih ve bölgeye göre liste', 'Aktivite detayı ve harita', 'Gizleme / kaldırma'],
  },
  {
    slug: 'rotalar',
    href: '/admin/rotalar',
    label: 'Rotalar',
    plan: ['Herkese açık rotalar', 'Öne çıkarılan rotalar (Keşfet)', 'Hatalı / tehlikeli rota bildirimleri'],
  },
  {
    slug: 'topluluklar',
    href: '/admin/topluluklar',
    label: 'Gruplar & topluluklar',
    plan: ['Topluluk listesi, üye sayıları', 'Doğrulanmış topluluk rozeti', 'Kapatma / devretme'],
  },
  {
    slug: 'etkinlikler',
    href: '/admin/etkinlikler',
    label: 'Etkinlikler',
    plan: ['Yaklaşan ve geçmiş etkinlikler', 'Katılım bilgileri', 'İptal / düzenleme'],
  },
  {
    slug: 'sikayetler',
    href: '/admin/sikayetler',
    label: 'Şikayetler',
    plan: ['Kullanıcı, gönderi, mesaj ve rota şikayetleri', 'İnceleme durumu ve not', 'Karar geçmişi'],
  },
];

export function sectionBySlug(slug: string): AdminSection {
  const s = adminSections.find((x) => x.slug === slug);
  if (!s) throw new Error(`Bilinmeyen admin bölümü: ${slug}`);
  return s;
}
