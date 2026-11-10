'use client';

import { useActionState } from 'react';

import { girisYap, type GirisDurumu } from './actions';
import styles from './giris.module.css';

export function GirisFormu({ sonra, uyari }: { sonra: string; uyari: string | null }) {
  const [durum, gonder, bekliyor] = useActionState<GirisDurumu, FormData>(girisYap, { hata: null, eposta: '' });
  const hata = durum.hata ?? uyari;
  return (
    <form action={gonder} className={styles.form} noValidate>
      <input type="hidden" name="sonra" value={sonra} />
      <label className={styles.label}>
        E-posta
        <input name="eposta" type="email" autoComplete="username" required defaultValue={durum.eposta} className={styles.input} />
      </label>
      <label className={styles.label}>
        Şifre
        <input name="sifre" type="password" autoComplete="current-password" required className={styles.input} />
      </label>
      {hata ? (
        <p role="alert" className={styles.hata}>
          {hata}
        </p>
      ) : null}
      <button type="submit" disabled={bekliyor} className={styles.button}>
        {bekliyor ? 'Giriş yapılıyor…' : 'Giriş yap'}
      </button>
    </form>
  );
}
