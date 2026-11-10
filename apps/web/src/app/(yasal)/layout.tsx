import Link from 'next/link';

import { Logo } from '@/components/Logo';
import styles from './yasal.module.css';

export default function YasalLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <Link href="/" aria-label="Lykiva ana sayfa">
          <Logo size={26} />
        </Link>
      </header>
      <main className={styles.metin}>{children}</main>
      <footer className={styles.alt}>
        <Link href="/gizlilik">Gizlilik politikası</Link>
        <Link href="/kosullar">Kullanım koşulları</Link>
        <Link href="/hesap-silme">Hesap silme</Link>
      </footer>
    </div>
  );
}
