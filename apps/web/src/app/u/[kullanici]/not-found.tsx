import Link from 'next/link';

import styles from './profil.module.css';

export default function ProfilBulunamadi() {
  return (
    <div className={`${styles.page} ${styles.durum}`}>
      <h1 className={styles.name}>Bu profil bulunamadı</h1>
      <p>Kullanıcı adı değişmiş ya da yanlış yazılmış olabilir.</p>
      <p>
        <Link href="/">Lykiva ana sayfası</Link>
      </p>
    </div>
  );
}
