import { ScreenShell } from '@/components/ScreenShell';

export default function PaylasimStudyosuScreen() {
  return (
    <ScreenShell
      title="Paylaş"
      plan={[
        'Paylaşım kartı önizlemesi; şablonlar: Gece, Kireçtaşı, Deniz, Kaya',
        'Kartta göster: mesafe, süre, tırmanış, maks./ort. hız, molalar, birlikte yaptıklarım',
        'Etiketlenen kişiler',
        'Başlangıç ve bitişi gizle (ev konumu görünmez)',
        'Hikâye, WhatsApp, Lykiva akışı, bağlantı, GPX / görsel ve diğer uygulamalar',
      ]}
    />
  );
}
