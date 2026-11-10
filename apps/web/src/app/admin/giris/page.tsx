import Link from 'next/link';
import { Suspense } from 'react';

import { Logo } from '@/components/Logo';
import { GirisFormu } from './GirisFormu';
import styles from './giris.module.css';

export default function YonetimGiris({ searchParams }: PageProps<'/admin/giris'>) {
  return (
    <div className={styles.page}>
      <main className={styles.card}>
        <Link href="/" aria-label="Lykiva ana sayfa" className={styles.brand}>
          <Logo size={26} />
          <span className={styles.badge}>Yönetim</span>
        </Link>
        <h1 className={styles.title}>Yönetim paneline giriş</h1>
        <p className={styles.lead}>Yalnızca yönetici olarak atanmış hesaplar girebilir.</p>
        <Suspense fallback={<GirisFormu sonra="/admin" uyari={null} />}>
          <Form searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<'/admin/giris'>['searchParams'] }) {
  const sp = await searchParams;
  const sonra = typeof sp.sonra === 'string' ? sp.sonra : '/admin';
  const uyari = sp.yetki === 'yok' ? 'Oturumun sona erdi ya da yönetim yetkin yok. Tekrar giriş yap.' : null;
  return <GirisFormu sonra={sonra} uyari={uyari} />;
}
