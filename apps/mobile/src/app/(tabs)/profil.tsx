import { ScreenShell } from '@/components/ScreenShell';

export default function ProfilScreen() {
  return (
    <ScreenShell
      title="Profil"
      showBack={false}
      plan={[
        'Profil bilgisi, aktivite / takipçi / takip sayıları',
        'Bu hafta: mesafe, süre, tırmanış ve günlük grafik',
        'Aktiviteler / Rotalarım / Gruplar sekmeleri',
        'Ayarlar ve gizlilik (canlı konum kimlere açık)',
      ]}
      links={[{ label: 'Örnek aktivite özeti', href: '/aktivite/ornek' }]}
    />
  );
}
