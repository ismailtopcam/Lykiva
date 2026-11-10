/** Panel sayfalarının ortak parçaları (sunucu bileşenleri) */
import Link from 'next/link';
import type { ReactNode } from 'react';

import styles from './admin.module.css';

export const SAYFA_BOYU = 50;

const tarihBicimi = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const gunBicimi = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', year: 'numeric' });
export const tarih = (iso: string | null) => (iso ? tarihBicimi.format(new Date(iso)) : '–');
export const gun = (iso: string | null) => (iso ? gunBicimi.format(new Date(iso)) : '–');
export const sayi = (n: number) => n.toLocaleString('tr-TR');

export const GORUNURLUK: Record<string, string> = { public: 'Herkese açık', followers: 'Takipçiler', groups: 'Gruplar', private: 'Özel' };

export function Baslik({ children, alt }: { children: ReactNode; alt?: ReactNode }) {
  return (
    <header className={styles.baslik}>
      <h1 className={styles.pageTitle}>{children}</h1>
      {alt ? <p className={styles.altBaslik}>{alt}</p> : null}
    </header>
  );
}

/** GET ile çalışan arama kutusu (?q=) */
export function Arama({ q, yer, ekstra }: { q: string; yer: string; ekstra?: Record<string, string> }) {
  return (
    <form role="search" className={styles.arama}>
      {Object.entries(ekstra ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="search" name="q" defaultValue={q} placeholder={yer} aria-label={yer} className={styles.aramaKutu} />
      <button type="submit" className={styles.btn}>
        Ara
      </button>
    </form>
  );
}

export function Sayfalama({ yol, q, sayfa, toplam, ekstra }: { yol: string; q: string; sayfa: number; toplam: number; ekstra?: Record<string, string> }) {
  const son = Math.max(0, Math.ceil(toplam / SAYFA_BOYU) - 1);
  if (son === 0) return <p className={styles.sayfaBilgi}>{sayi(toplam)} kayıt</p>;
  const href = (s: number) => {
    const p = new URLSearchParams({ ...(ekstra ?? {}), ...(q ? { q } : {}), ...(s ? { sayfa: String(s) } : {}) });
    const t = p.toString();
    return t ? `${yol}?${t}` : yol;
  };
  return (
    <nav aria-label="Sayfalar" className={styles.sayfalama}>
      {sayfa > 0 ? <Link href={href(sayfa - 1)}>← Önceki</Link> : <span />}
      <span className={styles.sayfaBilgi}>
        {sayi(toplam)} kayıt · sayfa {sayfa + 1} / {son + 1}
      </span>
      {sayfa < son ? <Link href={href(sayfa + 1)}>Sonraki →</Link> : <span />}
    </nav>
  );
}

export function Bos({ children }: { children: ReactNode }) {
  return <p className={styles.bos}>{children}</p>;
}

export function Yukleniyor() {
  return (
    <p className={styles.bos} aria-busy="true">
      Yükleniyor…
    </p>
  );
}

export function Etiket({ children, ton = 'gri' }: { children: ReactNode; ton?: 'gri' | 'deniz' | 'toprak' | 'koyu' }) {
  return <span className={`${styles.etiket} ${styles[`etiket_${ton}`]}`}>{children}</span>;
}
