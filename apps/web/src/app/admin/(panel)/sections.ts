export type AdminSection = { slug: string; href: string; label: string };

export const adminSections: AdminSection[] = [
  { slug: 'genel', href: '/admin', label: 'Genel bakış' },
  { slug: 'sikayetler', href: '/admin/sikayetler', label: 'Şikayetler' },
  { slug: 'kullanicilar', href: '/admin/kullanicilar', label: 'Kullanıcılar' },
  { slug: 'aktiviteler', href: '/admin/aktiviteler', label: 'Aktiviteler' },
  { slug: 'rotalar', href: '/admin/rotalar', label: 'Rotalar' },
  { slug: 'topluluklar', href: '/admin/topluluklar', label: 'Gruplar & topluluklar' },
  { slug: 'etkinlikler', href: '/admin/etkinlikler', label: 'Etkinlikler' },
];
