import { ScreenShell } from '@/components/ScreenShell';

export default function RotaPaylasScreen() {
  return (
    <ScreenShell
      title="Rotayı paylaş"
      plan={[
        'Gruplar ve topluluklar: çoklu seçim',
        'Kişiler: ekle / kaldır',
        'Düzenlemeye izin ver',
        'Bu rotayla etkinlik oluştur',
        '"N yere gönder"',
      ]}
      links={[
        { label: 'Bu rotayla etkinlik oluştur', href: '/etkinlik/olustur' },
        { label: 'Gönder (grup sohbeti)', href: '/grup/ornek/sohbet' },
      ]}
    />
  );
}
