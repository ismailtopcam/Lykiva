import Link from 'next/link';
import { Suspense } from 'react';

import { istekDili } from '@/lib/dil';
import { metinler } from '@/lib/sozluk';
import styles from './paylasim.module.css';

export default function PaylasimBulunamadi() {
  return (
    <Suspense fallback={null}>
      <Icerik />
    </Suspense>
  );
}

async function Icerik() {
  const dil = await istekDili();
  const m = metinler(dil);
  return (
    <div className={`${styles.page} ${styles.durum}`} lang={dil}>
      <h1 className={styles.title}>{m('aktivite_bulunamadi')}</h1>
      <p>{m('aktivite_bulunamadi_aciklama')}</p>
      <p>
        <Link href="/">{m('ana_sayfaya')}</Link>
      </p>
    </div>
  );
}
