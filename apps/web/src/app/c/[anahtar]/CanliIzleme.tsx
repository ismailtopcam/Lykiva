'use client';

/**
 * Canlı konumu 15 saniyede bir yoklar ve gösterir: kim, ne yapıyor, haritada nerede, en son ne zaman.
 * Molada değilken uzun süre hareket yoksa ve konum uzun süredir gelmiyorsa uyarır. Paylaşım bitince yoklamayı bırakır.
 */
import { activityLabel, doldur, formatDuration, formatKm, formatSpeedKmh, kmUnit, speedUnit, type Dil } from '@lykiva/shared';
import { useEffect, useState } from 'react';

import { HAREKETSIZ_DK, SESSIZ_DK, YOKLAMA_SN, type CanliVeri } from '@/lib/canli';
import type { CanliMetinler } from './page';
import { CanliHarita } from './CanliHarita';
import styles from './canli.module.css';

export function CanliIzleme({ anahtar, dil, t }: { anahtar: string; dil: Dil; t: CanliMetinler }) {
  // undefined: yükleniyor, null: böyle bir bağlantı yok
  const [veri, setVeri] = useState<CanliVeri | null | undefined>(undefined);
  const [baglantiSorunu, setBaglantiSorunu] = useState(false);
  const [simdi, setSimdi] = useState(() => Date.now());

  useEffect(() => {
    let iptal = false;
    let zaman: ReturnType<typeof setTimeout> | undefined;
    const yokla = async () => {
      try {
        const r = await fetch(`/c/${anahtar}/veri`, { cache: 'no-store' });
        if (r.status === 404) {
          if (!iptal) setVeri(null);
          return;
        }
        if (!r.ok) throw new Error(String(r.status));
        const v = (await r.json()) as CanliVeri;
        if (iptal) return;
        setVeri(v);
        setBaglantiSorunu(false);
        setSimdi(Date.now());
        if (v.durum === 'bitti') return;
      } catch {
        if (!iptal) setBaglantiSorunu(true);
      }
      if (!iptal) zaman = setTimeout(() => void yokla(), YOKLAMA_SN * 1000);
    };
    void yokla();
    // "x dk önce" yazıları yoklama beklemeden ilerlesin
    const saat = setInterval(() => setSimdi(Date.now()), 15_000);
    return () => {
      iptal = true;
      clearTimeout(zaman);
      clearInterval(saat);
    };
  }, [anahtar]);

  if (veri === undefined) {
    return (
      <section className={styles.kart} aria-busy="true">
        <p className={styles.soluk}>{baglantiSorunu ? t.canli_baglanti_hatasi : '…'}</p>
      </section>
    );
  }
  if (veri === null) {
    return (
      <section className={styles.kart}>
        <h1 className={styles.baslik}>{t.canli_bulunamadi}</h1>
        <p className={styles.soluk}>{t.canli_bulunamadi_aciklama}</p>
      </section>
    );
  }

  const ad = veri.ad ?? 'Lykiva';
  if (veri.durum !== 'canli') {
    const bitti = veri.durum === 'bitti';
    return (
      <section className={styles.kart}>
        <p className={styles.ust}>
          <span className={`${styles.rozet} ${bitti ? styles.rozetBitti : styles.rozetBekliyor}`}>{bitti ? t.canli_bitti : t.canli_bekliyor}</span>
        </p>
        <h1 className={styles.baslik}>{ad}</h1>
        <p className={styles.soluk}>{doldur(bitti ? t.canli_bitti_aciklama : t.canli_bekliyor_aciklama, { ad })}</p>
      </section>
    );
  }

  const dkOnce = (iso: string | null) => (iso ? Math.max(0, Math.floor((simdi - Date.parse(iso)) / 60_000)) : null);
  const sonKonumDk = dkOnce(veri.updated_at) ?? 0;
  const hareketsizDk = dkOnce(veri.son_hareket);
  const sessiz = sonKonumDk >= SESSIZ_DK;
  const hareketsiz = !veri.is_paused && !sessiz && hareketsizDk != null && hareketsizDk >= HAREKETSIZ_DK;
  const gecen = veri.started_at ? Math.max(0, Math.round((simdi - Date.parse(veri.started_at)) / 1000)) : null;
  const saat = new Date(veri.bitis).toLocaleTimeString(dil, { hour: '2-digit', minute: '2-digit' });

  return (
    <section className={styles.kart} aria-live="polite">
      <p className={styles.ust}>
        <span className={`${styles.rozet} ${veri.is_paused ? styles.rozetMola : styles.rozetCanli}`}>
          {veri.is_paused ? null : <span className={styles.nabiz} aria-hidden="true" />}
          {veri.is_paused ? t.canli_molada : t.canli_canli}
        </span>
        {veri.activity ? <span className={styles.soluk}>{activityLabel(veri.activity, dil)}</span> : null}
      </p>
      <h1 className={styles.baslik}>{ad}</h1>
      <p className={styles.soluk}>
        {t.canli_son_konum} {sonKonumDk < 1 ? t.canli_az_once : doldur(t.canli_dk_once, { dk: sonKonumDk })}
      </p>

      {sessiz ? (
        <p className={styles.uyari} role="alert">
          {doldur(t.canli_sessiz, { dk: sonKonumDk, ad })}
        </p>
      ) : hareketsiz ? (
        <p className={styles.uyari} role="alert">
          {doldur(t.canli_hareketsiz, { dk: hareketsizDk ?? 0, ad })}
        </p>
      ) : null}
      {baglantiSorunu ? <p className={styles.soluk}>{t.canli_baglanti_hatasi}</p> : null}

      <CanliHarita konum={[veri.lng, veri.lat]} iz={veri.iz} etiket={t.canli_harita} />

      <dl className={styles.olculer}>
        <div>
          <dt>{t.canli_mesafe}</dt>
          <dd>
            {veri.distance_m != null ? formatKm(veri.distance_m, dil) : '–'} <small>{kmUnit(dil)}</small>
          </dd>
        </div>
        <div>
          <dt>{t.canli_sure}</dt>
          <dd>{gecen != null ? formatDuration(gecen) : '–'}</dd>
        </div>
        <div>
          <dt>{t.canli_hiz}</dt>
          <dd>
            {veri.speed_mps != null && !veri.is_paused ? formatSpeedKmh(veri.speed_mps, dil) : '–'} <small>{speedUnit(dil)}</small>
          </dd>
        </div>
      </dl>

      <a className={styles.dugme} href={`https://www.google.com/maps/search/?api=1&query=${veri.lat.toFixed(6)},${veri.lng.toFixed(6)}`} target="_blank" rel="noreferrer">
        {t.canli_haritalarda_ac}
      </a>
      <p className={styles.kapanis}>{doldur(t.canli_kapanis, { saat })}</p>
    </section>
  );
}
