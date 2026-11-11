'use client';

import { ACTIVITY_LABELS, ACTIVITY_TYPES } from '@lykiva/shared';
import { useActionState, useState } from 'react';

import { meydanOkumaOlustur, type AyarDurumu } from '../actions';
import styles from '../admin.module.css';

const BIRIM: Record<string, string> = { mesafe: 'km', sure: 'saat', sayi: 'aktivite', tirmanis: 'm' };

/** Herkese açık meydan okuma açma formu (grup meydan okumaları uygulamadan açılır) */
export function MeydanOkumaFormu({ bugun, ayinSonu }: { bugun: string; ayinSonu: string }) {
  const [durum, gonder, bekliyor] = useActionState<AyarDurumu, FormData>(meydanOkumaOlustur, { mesaj: null, hata: null });
  const [olcu, setOlcu] = useState('mesafe');
  return (
    <form action={gonder} className={styles.ayarForm}>
      <label className={styles.ayarAlan}>
        <span>Ad</span>
        <input name="baslik" required minLength={2} maxLength={80} placeholder="ör. Kasım'da 200 km" className={styles.notKutu} />
      </label>
      <div className={styles.formSatir}>
        <label className={styles.ayarAlan}>
          <span>Ölçü</span>
          <select name="olcu" value={olcu} onChange={(e) => setOlcu(e.target.value)} className={styles.notKutu}>
            <option value="mesafe">Mesafe</option>
            <option value="sure">Süre (hareket)</option>
            <option value="sayi">Aktivite sayısı</option>
            <option value="tirmanis">Tırmanış</option>
          </select>
        </label>
        <label className={styles.ayarAlan}>
          <span>Hedef ({BIRIM[olcu]})</span>
          <input name="hedef" type="number" required min={olcu === 'sayi' ? 1 : 0.1} step={olcu === 'sayi' ? 1 : 0.1} className={styles.notKutu} />
        </label>
      </div>
      <div className={styles.formSatir}>
        <label className={styles.ayarAlan}>
          <span>Başlangıç</span>
          <input name="baslangic" type="date" required defaultValue={bugun} className={styles.notKutu} />
        </label>
        <label className={styles.ayarAlan}>
          <span>Bitiş (dahil)</span>
          <input name="bitis" type="date" required defaultValue={ayinSonu} className={styles.notKutu} />
        </label>
      </div>
      <fieldset className={styles.ayarAlan}>
        <legend>Sayılan aktiviteler</legend>
        <div className={styles.turler}>
          {ACTIVITY_TYPES.map((t) => (
            <label key={t}>
              <input type="checkbox" name="turler" value={t} /> {ACTIVITY_LABELS[t]}
            </label>
          ))}
        </div>
        <small>Hiçbiri seçilmezse bütün türler sayılır. Tarihler Türkiye saatine göre; başlangıç en fazla bir ay önce olabilir.</small>
      </fieldset>
      <label className={styles.ayarAlan}>
        <span>Açıklama</span>
        <textarea name="aciklama" maxLength={1000} rows={3} placeholder="İsteğe bağlı" className={styles.notKutu} />
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
          {bekliyor ? 'Açılıyor…' : 'Meydan okumayı aç'}
        </button>
      </div>
    </form>
  );
}
