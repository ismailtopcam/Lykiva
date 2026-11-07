import { ScreenShell } from '@/components/ScreenShell';

export default function DuraklatildiScreen() {
  return (
    <ScreenShell
      title="Duraklatıldı"
      dark
      plan={[
        'Donmuş hareket süresi ve işleyen mola süresi',
        'Yapılan / kalan km, ortalama hız',
        'Gruba hızlı mesaj: "Mola veriyorum", "Beni bekleyin"…',
        'Molaya fotoğraf veya not ekleme (haritaya işlenir)',
        'Devam et / Bitir ve kaydet; otomatik duraklatma',
      ]}
      links={[
        { label: 'Devam et', href: '/kayit/canli' },
        { label: 'Bitir ve kaydet (özet)', href: '/aktivite/ornek' },
      ]}
    />
  );
}
