'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { adminSections } from './sections';
import styles from './admin.module.css';

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Yönetim menüsü" className={styles.nav}>
      {adminSections.map((s) => {
        const active = pathname === s.href;
        return (
          <Link
            key={s.slug}
            href={s.href}
            aria-current={active ? 'page' : undefined}
            className={active ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}>
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
