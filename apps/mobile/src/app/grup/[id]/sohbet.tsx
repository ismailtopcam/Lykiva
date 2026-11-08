import { ScreenShell } from '@/components/ScreenShell';

export default function GrupSohbetScreen() {
  return (
    <ScreenShell
      title="Grup sohbeti"
      plan={[
        'Sabitlenmiş etkinlik şeridi',
        'Mesajlar: metin, rota kartı, aktivite kartı, anket',
        '"N kişi şu an yolda" ve canlı haritaya geçiş',
        'Mesaj yazma; rota, etkinlik veya konum ekleme',
      ]}
      links={[{ label: 'Canlı harita', href: '/canli-harita' }]}
    />
  );
}
