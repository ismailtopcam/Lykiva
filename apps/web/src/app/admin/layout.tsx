import type { Metadata } from 'next';
import Link from 'next/link';

import { Logo } from '@/components/Logo';
import { AdminNav } from './AdminNav';
import styles from './admin.module.css';

export const metadata: Metadata = {
  title: 'Yönetim',
  robots: { index: false, follow: false },
};

/**
 * Yönetim paneli kabuğu.
 * TODO (2. aşama): Supabase oturumu + yalnızca admin rolündekilere erişim.
 */
export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/admin" className={styles.brand} aria-label="Yönetim paneli ana sayfa">
          <Logo size={24} />
          <span className={styles.badge}>Yönetim</span>
        </Link>
        <AdminNav />
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
