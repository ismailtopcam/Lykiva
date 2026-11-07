import { ScreenShell } from '@/components/ScreenShell';

export default function RotaDetayScreen() {
  return (
    <ScreenShell
      title="Rota detayı"
      plan={[
        'Fotoğraflar, zorluk, aktivite türü, tek yön / gidiş-dönüş',
        'Mesafe, tırmanış, ortalama süre; yükseklik profili',
        'Bu rotayı yapanlar (arkadaşların önce)',
        'Topluluk notları',
        'Kaydet, çevrimdışı indir, paylaş',
      ]}
      links={[
        { label: 'Bu rotayı başlat', href: '/kayit' },
        { label: 'Grupla planla (etkinlik)', href: '/etkinlik/olustur' },
        { label: 'Rotayı paylaş', href: '/rota/ornek/paylas' },
      ]}
    />
  );
}
