import { Suspense } from 'react';

import { siteAyarlari, VARSAYILAN_AYARLAR, ya } from '@/lib/site';

/** İletişim e-postası (yönetim panelinden değişir); yüklenirken varsayılan görünür */
export function Eposta() {
  const yedek = <a href={`mailto:${VARSAYILAN_AYARLAR.iletisim_eposta}`}>{VARSAYILAN_AYARLAR.iletisim_eposta}</a>;
  return (
    <Suspense fallback={yedek}>
      <EpostaIcerik />
    </Suspense>
  );
}

async function EpostaIcerik() {
  const { iletisim_eposta } = await siteAyarlari();
  return <a href={`mailto:${iletisim_eposta}`}>{iletisim_eposta}</a>;
}

/** Veri sorumlusunun adı / unvanı ve adresi */
export function Sorumlu() {
  return (
    <Suspense fallback={<span>…</span>}>
      <SorumluIcerik />
    </Suspense>
  );
}

async function SorumluIcerik() {
  const a = await siteAyarlari();
  return (
    <>
      {ya(a.veri_sorumlusu)}
      {a.veri_sorumlusu_adres.trim() ? `, ${a.veri_sorumlusu_adres.trim()}` : ''}
    </>
  );
}
