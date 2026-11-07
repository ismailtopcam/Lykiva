import { ScreenShell } from '@/components/ScreenShell';

export default function AktiviteOzetiScreen() {
  return (
    <ScreenShell
      title="Aktivite özeti"
      plan={[
        'Yüksekliğe göre renklendirilmiş rota haritası, mola noktaları, en yüksek hız noktası',
        'Mesafe, hareket süresi, toplam süre',
        'Maksimum, ortalama ve minimum hız (minimum yalnızca hareketteyken)',
        'Yükseklik profili (tırmanış / iniş / en yüksek nokta)',
        'Birlikte yapılan kişiler',
      ]}
      links={[
        { label: 'Hız & molalar', href: '/aktivite/ornek/hiz' },
        { label: 'İnişli çıkışlı harita (3B)', href: '/aktivite/ornek/uc-boyut' },
        { label: 'Paylaş', href: '/aktivite/ornek/paylas' },
      ]}
    />
  );
}
