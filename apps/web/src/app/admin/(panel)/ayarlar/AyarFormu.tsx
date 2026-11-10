'use client';

import { useActionState } from 'react';

import { siteAyarlariKaydet, type AyarDurumu } from '../actions';
import styles from '../admin.module.css';

type Ayarlar = { iletisim_eposta: string; veri_sorumlusu: string; veri_sorumlusu_adres: string };

export function AyarFormu({ ayarlar }: { ayarlar: Ayarlar }) {
  const [durum, gonder, bekliyor] = useActionState<AyarDurumu, FormData>(siteAyarlariKaydet, { mesaj: null, hata: null });
  return (
    <form action={gonder} className={styles.ayarForm}>
      <label className={styles.ayarAlan}>
        <span>İletişim e-postası</span>
        <input name="iletisim_eposta" type="email" required defaultValue={ayarlar.iletisim_eposta} maxLength={300} className={styles.notKutu} />
        <small>Gizlilik politikası, kullanım koşulları ve hesap silme sayfalarında görünür; KVKK başvuruları buraya gelir.</small>
      </label>
      <label className={styles.ayarAlan}>
        <span>Veri sorumlusu</span>
        <input name="veri_sorumlusu" defaultValue={ayarlar.veri_sorumlusu} maxLength={300} placeholder="Ad soyad ya da şirket unvanı" className={styles.notKutu} />
        <small>KVKK&apos;ya göre verilerden sorumlu kişi ya da şirket. Boşken sayfada &quot;[doldurulacak]&quot; yazar.</small>
      </label>
      <label className={styles.ayarAlan}>
        <span>Veri sorumlusunun adresi</span>
        <input name="veri_sorumlusu_adres" defaultValue={ayarlar.veri_sorumlusu_adres} maxLength={300} placeholder="İsteğe bağlı" className={styles.notKutu} />
      </label>
      {durum.hata ? (
        <p role="alert" className={styles.ayarHata}>
          {durum.hata}
        </p>
      ) : durum.mesaj ? (
        <p role="status" className={styles.ayarMesaj}>
          {durum.mesaj}
        </p>
      ) : null}
      <div>
        <button type="submit" disabled={bekliyor} className={styles.btn}>
          {bekliyor ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </form>
  );
}
