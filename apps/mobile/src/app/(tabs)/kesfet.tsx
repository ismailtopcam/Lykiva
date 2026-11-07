import { ScreenShell } from '@/components/ScreenShell';

export default function KesfetScreen() {
  return (
    <ScreenShell
      title="Keşfet"
      showBack={false}
      plan={[
        'Rota, topluluk, etkinlik ve kişi araması',
        'Yakınında bu hafta: yaklaşan etkinlikler',
        'Sana uygun topluluklar: katıl / istek gönder',
        'Topluluk kurma',
      ]}
      links={[
        { label: 'Örnek rota detayı', href: '/rota/ornek' },
        { label: 'Rota oluştur', href: '/rota/olustur' },
        { label: 'Örnek etkinlik', href: '/etkinlik/ornek' },
      ]}
    />
  );
}
