import { ScreenShell } from '@/components/ScreenShell';

export default function GruplarScreen() {
  return (
    <ScreenShell
      title="Gruplar"
      showBack={false}
      plan={[
        'Üye olduğun gruplar ve topluluklar',
        'Okunmamış mesaj sayıları',
        'Yeni grup oluşturma, davet bağlantısı',
      ]}
      links={[
        { label: 'Örnek grup sayfası', href: '/grup/ornek' },
        { label: 'Örnek grup sohbeti', href: '/grup/ornek/sohbet' },
        { label: 'Etkinlik oluştur', href: '/etkinlik/olustur' },
      ]}
    />
  );
}
