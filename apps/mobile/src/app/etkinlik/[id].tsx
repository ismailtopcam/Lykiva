import { ScreenShell } from '@/components/ScreenShell';

export default function EtkinlikDetayScreen() {
  return (
    <ScreenShell
      title="Etkinlik"
      plan={[
        'Rota ve buluşma noktası haritası',
        'Tarih / saat (takvime ekle), buluşma noktası, rota bilgisi',
        'Katılımcılar ve kontenjan',
        'Katılıyorum / Belki / Gelemem',
        'Etkinlik başlayınca katılımcılar birbirini canlı haritada görür',
      ]}
      links={[
        { label: 'Rota detayı', href: '/rota/ornek' },
        { label: 'Sohbete git', href: '/grup/ornek/sohbet' },
      ]}
    />
  );
}
