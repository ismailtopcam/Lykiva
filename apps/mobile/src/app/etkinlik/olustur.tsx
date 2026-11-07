import { ScreenShell } from '@/components/ScreenShell';

export default function EtkinlikOlusturScreen() {
  return (
    <ScreenShell
      title="Yeni etkinlik"
      plan={[
        'Etkinlik adı, tarih, başlangıç saati',
        'Buluşma noktası ve rota',
        'Seviye: kolay / orta / zor',
        'Kontenjan (dolunca bekleme listesi)',
        'Kimler görebilir: grup / bağlı topluluklar / herkese açık',
      ]}
      links={[{ label: 'Etkinliği yayınla', href: '/etkinlik/ornek' }]}
    />
  );
}
