import Link from 'next/link';
import { Suspense } from 'react';

import { istekDili } from '@/lib/dil';
import { metinler } from '@/lib/sozluk';
import styles from './profil.module.css';

export default function ProfilBulunamadi() {
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
      <h1 className={styles.name}>{m('profil_bulunamadi')}</h1>
      <p>{m('profil_bulunamadi_aciklama')}</p>
      <p>
        <Link href="/">{m('ana_sayfaya')}</Link>
      </p>
    </div>
  );
}
