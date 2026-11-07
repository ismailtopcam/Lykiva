import { ScreenShell } from '@/components/ScreenShell';

export default function CanliHaritaScreen() {
  return (
    <ScreenShell
      title="Canlı harita"
      plan={[
        'Arkadaşların / grubun anlık konumları, hız veya tempo etiketleri',
        'Arkadaşlar / grup filtresi, konumuma git',
        '"Şu an yolda" listesi: izle, mesaj',
        'Canlı konumumu paylaş ve kimlerin göreceği',
      ]}
      links={[{ label: 'Canlı takibi izle', href: '/kayit/canli' }]}
    />
  );
}
