import { activityLabel, formatKm, havaAyrintilari, havaGecerliMi, havaOzeti, type Dil, kmUnit, mUnit } from '@lykiva/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { Logo } from '@/components/Logo';
import { istekDili, OG_YEREL } from '@/lib/dil';
import { aciklama, baslik, istatistikler, izCiz, paylasilanAktivite, profilCiz, tarihMetni, type PaylasilanAktivite } from '@/lib/paylasim';
import { metinler, type Metin } from '@/lib/sozluk';
import styles from './paylasim.module.css';

// Paylaşım sayfaları arama motorlarında listelenmez (bağlantıyı bilen görür)
const GIZLI = { index: false, follow: false } as const;

export async function generateMetadata({ params, searchParams }: PageProps<'/a/[anahtar]'>): Promise<Metadata> {
  const { anahtar } = await params;
  const dil = await istekDili(searchParams);
  const m = metinler(dil);
  const s = await paylasilanAktivite(anahtar);
  if (s.durum !== 'var') return { title: m('paylasim'), robots: GIZLI };
  const t = baslik(s.a, dil);
  return {
    title: t,
    description: aciklama(s.a, dil),
    robots: GIZLI,
    openGraph: { title: t, description: aciklama(s.a, dil), type: 'article', siteName: 'Lykiva', locale: OG_YEREL[dil] },
    twitter: { card: 'summary_large_image', title: t, description: aciklama(s.a, dil) },
  };
}

export default function PaylasimSayfasi({ params, searchParams }: PageProps<'/a/[anahtar]'>) {
  return (
    <Suspense fallback={<Iskelet />}>
      <Sayfa params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Sayfa({ params, searchParams }: Pick<PageProps<'/a/[anahtar]'>, 'params' | 'searchParams'>) {
  const dil = await istekDili(searchParams);
  const m = metinler(dil);
  return (
    <div className={styles.page} lang={dil}>
      <header className={styles.nav}>
        <Link href="/" aria-label={m('ana_sayfa')} className={styles.brand}>
          <Logo size={26} />
        </Link>
      </header>
      <main>
        <Icerik params={params} dil={dil} m={m} />
        <section className={styles.cta} aria-label={m('hakkinda')}>
          <p className={styles.ctaTitle}>{m('slogan')}</p>
          <p className={styles.ctaBody}>{m('cta_aktivite')}</p>
          <p className={styles.ctaSoon}>{m('yakinda')}</p>
        </section>
      </main>
    </div>
  );
}

async function Icerik({ params, dil, m }: { params: PageProps<'/a/[anahtar]'>['params']; dil: Dil; m: Metin }) {
  const { anahtar } = await params;
  const s = await paylasilanAktivite(anahtar);
  if (s.durum === 'yok') notFound();
  if (s.durum !== 'var') {
    return (
      <div className={styles.durum} role="alert">
        <h1 className={styles.title}>{m('acilamadi')}</h1>
        <p>{s.durum === 'ayarsiz' ? m('paylasim_ayarsiz') : m('sunucu_yok')}</p>
      </div>
    );
  }
  return <Aktivite a={s.a} dil={dil} m={m} />;
}

function Aktivite({ a, dil, m }: { a: PaylasilanAktivite; dil: Dil; m: Metin }) {
  const t = baslik(a, dil);
  return (
    <article>
      <p className={styles.meta}>
        <span className={styles.owner}>{a.owner_name}</span> · {activityLabel(a.activity, dil)}
      </p>
      <h1 className={styles.title}>{t}</h1>
      <p className={styles.when}>{tarihMetni(a.started_at, dil)}</p>

      <Harita a={a} baslik={t} dil={dil} m={m} />

      <dl className={styles.stats}>
        {istatistikler(a, dil).map((i) => (
          <div key={i.etiket} className={styles.stat}>
            <dt>{i.etiket}</dt>
            <dd>
              {i.deger}
              {i.birim ? <span className={styles.unit}> {i.birim}</span> : null}
            </dd>
          </div>
        ))}
      </dl>

      <Profil a={a} dil={dil} m={m} />
      <Hava a={a} dil={dil} m={m} />

      <p className={styles.social}>
        <span>{m('begeni', { n: a.like_count })}</span>
        <span aria-hidden="true">·</span>
        <span>{m('yorum', { n: a.comment_count })}</span>
        {a.stop_count ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{m('mola', { n: a.stop_count })}</span>
          </>
        ) : null}
      </p>
    </article>
  );
}

function Harita({ a, baslik: t, dil, m }: { a: PaylasilanAktivite; baslik: string; dil: Dil; m: Metin }) {
  const W = 720;
  const H = 420;
  if (!a.track || a.track.length < 2) {
    return (
      <div className={styles.mapEmpty}>
        <p>{a.endpoints_hidden ? m('iz_kisa') : m('iz_yok')}</p>
      </div>
    );
  }
  const iz = izCiz(a.track, W, H, 36);
  return (
    <figure className={styles.map}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={m('rota_etiket', { baslik: t, km: formatKm(a.distance_m, dil) })}>
        <rect width={W} height={H} fill="var(--land)" />
        <g fill="none" stroke="var(--line-strong)" strokeWidth="1.2" opacity="0.7">
          <ellipse cx={W * 0.22} cy={H * 0.3} rx="120" ry="60" />
          <ellipse cx={W * 0.22} cy={H * 0.3} rx="70" ry="32" />
          <ellipse cx={W * 0.78} cy={H * 0.72} rx="150" ry="70" />
          <ellipse cx={W * 0.78} cy={H * 0.72} rx="90" ry="40" />
        </g>
        <path d={iz.d} fill="none" stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <path d={iz.d} fill="none" stroke="var(--terra)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={iz.bas[0]} cy={iz.bas[1]} r="8" fill="#FFFFFF" stroke="var(--sea)" strokeWidth="3.5" />
        <circle cx={iz.son[0]} cy={iz.son[1]} r="8" fill="var(--ink)" stroke="#FFFFFF" strokeWidth="3" />
      </svg>
      {a.endpoints_hidden ? <figcaption>{m('uclar_gizli')}</figcaption> : null}
    </figure>
  );
}

function Profil({ a, dil, m }: { a: PaylasilanAktivite; dil: Dil; m: Metin }) {
  if (a.elevation.length < 2) return null;
  const W = 720;
  const H = 120;
  const p = profilCiz(a.elevation, W, H);
  return (
    <section className={styles.profile} aria-label={m('yukseklik_profili')}>
      <div className={styles.profileHead}>
        <h2>{m('yukseklik')}</h2>
        <span>
          ↑ {Math.round(a.elevation_gain_m ?? 0)} {mUnit(dil)} · ↓ {Math.round(a.elevation_loss_m ?? 0)} {mUnit(dil)}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={m('profil_etiket', { min: p.zMin, max: p.zMax })}>
        <path d={p.alan} fill="var(--sea-soft)" />
        <path d={p.cizgi} fill="none" stroke="var(--sea)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className={styles.profileAxis}>
        <span>0 {kmUnit(dil)}</span>
        <span>
          {p.zMin}–{p.zMax} {mUnit(dil)}
        </span>
        <span>
          {formatKm(p.dMax, dil)} {kmUnit(dil)}
        </span>
      </div>
    </section>
  );
}

function Hava({ a, dil, m }: { a: PaylasilanAktivite; dil: Dil; m: Metin }) {
  if (!havaGecerliMi(a.weather)) return null;
  const h = a.weather;
  // Rüzgârın yola göre etkisi kırpılmış izden hesaplanır (konum gösterilmez)
  const iz = a.track?.map(([lng, lat]) => ({ lat, lng }));
  return (
    <section className={styles.hava} aria-labelledby="hava-baslik">
      <div className={styles.profileHead}>
        <h2 id="hava-baslik">{m('hava')}</h2>
        <span>{havaOzeti(h, dil)}</span>
      </div>
      <dl className={styles.havaListe}>
        {havaAyrintilari(h, iz, dil).map(([etiket, deger]) => (
          <div key={etiket}>
            <dt>{etiket}</dt>
            <dd>{deger}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.havaKaynak}>{m('hava_kaynak')}</p>
    </section>
  );
}

function Iskelet() {
  return (
    <div className={styles.page} aria-busy="true">
      <div className={`${styles.skel} ${styles.skelLine}`} style={{ width: '40%' }} />
      <div className={`${styles.skel} ${styles.skelTitle}`} />
      <div className={`${styles.skel} ${styles.skelMap}`} />
    </div>
  );
}
