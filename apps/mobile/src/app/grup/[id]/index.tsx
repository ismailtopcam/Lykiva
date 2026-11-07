import { ScreenShell } from '@/components/ScreenShell';

export default function GrupScreen() {
  return (
    <ScreenShell
      title="Grup"
      plan={[
        'Grup adı, türü, üyeler, özel / herkese açık',
        'Kısayollar: sohbet, etkinlik, rota paylaş',
        'Akış / Rotalar / Etkinlikler / Üyeler sekmeleri',
        'Sıradaki grup etkinliği ve katılım',
        'Bu ay grupça toplam km ve sürüş sayısı',
      ]}
      links={[
        { label: 'Sohbet', href: '/grup/ornek/sohbet' },
        { label: 'Etkinlik oluştur', href: '/etkinlik/olustur' },
        { label: 'Sıradaki etkinlik', href: '/etkinlik/ornek' },
      ]}
    />
  );
}
