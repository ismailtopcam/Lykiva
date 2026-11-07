import { ScreenShell } from '@/components/ScreenShell';

export default function CanliTakipScreen() {
  return (
    <ScreenShell
      title="Kayıtta"
      dark
      plan={[
        'Harita: tamamlanan ve kalan rota, grup arkadaşlarının konumu',
        'Anlık hız (büyük)',
        'Yapılan km, kalan km, ortalama hıza göre varışa kalan süre',
        'Süre, ortalama hız, tırmanış; rota ilerleme çubuğu',
        'Duraklat, ekranı kilitle, gruba sesli mesaj',
      ]}
      links={[{ label: 'Duraklat', href: '/kayit/duraklatildi' }]}
    />
  );
}
