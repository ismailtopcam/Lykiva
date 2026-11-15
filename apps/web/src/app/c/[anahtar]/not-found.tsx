import Link from 'next/link';
import { Suspense } from 'react';

import { istekDili } from '@/lib/dil';
import { metinler } from '@/lib/sozluk';
import styles from './canli.module.css';

export default function CanliBulunamadi() {
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
    <div className={styles.page} lang={dil}>
      <section className={styles.kart}>
        <h1 className={styles.baslik}>{m('canli_bulunamadi')}</h1>
        <p className={styles.soluk}>{m('canli_bulunamadi_aciklama')}</p>
        <p className={styles.soluk}>
          <Link href="/">{m('ana_sayfaya')}</Link>
        </p>
      </section>
    </div>
  );
}
