/**
 * Canlı konum sayfası: kayıt süren kişinin konumu haritada, 15 saniyede bir yenilenir. Bağlantıyı bilen görür;
 * arama motorlarında listelenmez. Veri tarayıcıda yoklanır (CanliIzleme), sayfanın kendisi önbelleğe alınabilir.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { Logo } from '@/components/Logo';
import { CANLI_ANAHTAR } from '@/lib/canli';
import { istekDili } from '@/lib/dil';
import { hamMetin, metinler, type WebSozluk } from '@/lib/sozluk';
import { CanliIzleme } from './CanliIzleme';
import styles from './canli.module.css';

const GIZLI = { index: false, follow: false } as const;

/** İzleme bileşenine giden metinler (tarayıcıda yer tutucular doldurulur) */
const ANAHTARLAR = [
  'canli_baslik',
  'canli_canli',
  'canli_molada',
  'canli_bitti',
  'canli_bitti_aciklama',
  'canli_bekliyor',
  'canli_bekliyor_aciklama',
  'canli_son_konum',
  'canli_az_once',
  'canli_dk_once',
  'canli_hareketsiz',
  'canli_sessiz',
  'canli_mesafe',
  'canli_sure',
  'canli_hiz',
  'canli_haritalarda_ac',
  'canli_baglanti_hatasi',
  'canli_bulunamadi',
  'canli_bulunamadi_aciklama',
  'canli_kapanis',
  'canli_harita',
] as const satisfies readonly (keyof WebSozluk)[];
export type CanliMetinler = Record<(typeof ANAHTARLAR)[number], string>;

export async function generateMetadata({ searchParams }: PageProps<'/c/[anahtar]'>): Promise<Metadata> {
  const m = metinler(await istekDili(searchParams));
  return { title: m('canli_baslik'), robots: GIZLI };
}

export default function CanliSayfa({ params, searchParams }: PageProps<'/c/[anahtar]'>) {
  return (
    <Suspense fallback={<div className={styles.page} />}>
      <Sayfa params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Sayfa({ params, searchParams }: Pick<PageProps<'/c/[anahtar]'>, 'params' | 'searchParams'>) {
  const { anahtar } = await params;
  if (!CANLI_ANAHTAR.test(anahtar)) notFound();
  const dil = await istekDili(searchParams);
  const m = metinler(dil);
  // Yer tutucular ({dk}, {ad}, {saat}) tarayıcıda doldurulsun diye ham metin
  const t = Object.fromEntries(ANAHTARLAR.map((k) => [k, hamMetin(dil, k)])) as CanliMetinler;
  return (
    <div className={styles.page} lang={dil}>
      <header className={styles.nav}>
        <Link href="/" aria-label={m('ana_sayfa')} className={styles.brand}>
          <Logo size={26} />
        </Link>
      </header>
      <main>
        <CanliIzleme anahtar={anahtar} dil={dil} t={t} />
      </main>
    </div>
  );
}
