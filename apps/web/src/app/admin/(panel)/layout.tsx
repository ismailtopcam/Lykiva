import Link from 'next/link';

import { Logo } from '@/components/Logo';
import { cikisYap } from '../giris/actions';
import { AdminNav } from './AdminNav';
import styles from './admin.module.css';

/** Panel kabuğu. Oturum kontrolü src/proxy.ts'te, yetki kontrolü her veri çağrısında (veritabanı). */
export default function PanelLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/admin" className={styles.brand} aria-label="Yönetim paneli ana sayfa">
          <Logo size={24} />
          <span className={styles.badge}>Yönetim</span>
        </Link>
        <AdminNav />
        <form action={cikisYap} className={styles.cikis}>
          <button type="submit" className={styles.cikisBtn}>
            Çıkış yap
          </button>
        </form>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
