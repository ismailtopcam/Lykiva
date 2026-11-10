import Link from 'next/link';
import { Suspense } from 'react';

import { yonetimRpc } from '@/lib/yonetim/veri';
import { VARSAYILAN_AYARLAR, type SiteAyarlari } from '@/lib/site';
import { Baslik, Yukleniyor } from '../ui';
import { AyarFormu } from './AyarFormu';

export default function Ayarlar() {
  return (
    <>
      <Baslik
        alt={
          <>
            Yasal sayfalarda görünen bilgiler: <Link href="/gizlilik">gizlilik</Link>, <Link href="/kosullar">koşullar</Link>,{' '}
            <Link href="/hesap-silme">hesap silme</Link>.
          </>
        }>
        Site ayarları
      </Baslik>
      <Suspense fallback={<Yukleniyor />}>
        <Icerik />
      </Suspense>
    </>
  );
}

async function Icerik() {
  // site_ayarlari() herkese açık; yine de yönetici oturumuyla okunur (oturum düşmüşse girişe yönlendirir)
  const a = await yonetimRpc<Partial<SiteAyarlari>>('site_ayarlari');
  return <AyarFormu ayarlar={{ ...VARSAYILAN_AYARLAR, ...a }} />;
}
