import Link from 'next/link';

import styles from './paylasim.module.css';

export default function PaylasimBulunamadi() {
  return (
    <div className={`${styles.page} ${styles.durum}`}>
      <h1 className={styles.title}>Bu bağlantı açık değil</h1>
      <p>Paylaşan kişi bağlantıyı kapatmış ya da adres yanlış yazılmış olabilir.</p>
      <p>
        <Link href="/">Lykiva ana sayfası</Link>
      </p>
    </div>
  );
}
