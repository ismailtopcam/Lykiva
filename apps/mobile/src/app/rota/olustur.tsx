import { ScreenShell } from '@/components/ScreenShell';

export default function RotaOlusturScreen() {
  return (
    <ScreenShell
      title="Rota oluştur"
      plan={[
        'Haritaya dokunarak ara nokta ekleme; geri al',
        'Çizim modu: patikaya yapış / yola yapış / serbest çiz',
        'Rota adı, mesafe, tırmanış, aktivite türüne göre tahmini süre',
        'Zemin dağılımı: asfalt / toprak yol / patika',
        'Kaydet, kaydet ve paylaş',
      ]}
      links={[{ label: 'Kaydet ve paylaş', href: '/rota/ornek/paylas' }]}
    />
  );
}
