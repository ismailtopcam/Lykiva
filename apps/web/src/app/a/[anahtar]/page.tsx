import { ACTIVITY_LABELS, formatKm } from '@lykiva/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { Logo } from '@/components/Logo';
import { aciklama, baslik, istatistikler, izCiz, paylasilanAktivite, profilCiz, tarihMetni, type PaylasilanAktivite } from '@/lib/paylasim';
import styles from './paylasim.module.css';

// Paylaşım sayfaları arama motorlarında listelenmez (bağlantıyı bilen görür)
const GIZLI = { index: false, follow: false } as const;

export async function generateMetadata({ params }: PageProps<'/a/[anahtar]'>): Promise<Metadata> {
  const { anahtar } = await params;
  const s = await paylasilanAktivite(anahtar);
  if (s.durum !== 'var') return { title: 'Paylaşım', robots: GIZLI };
  const t = baslik(s.a);
  return {
    title: t,
    description: aciklama(s.a),
    robots: GIZLI,
    openGraph: { title: t, description: aciklama(s.a), type: 'article', siteName: 'Lykiva', locale: 'tr_TR' },
    twitter: { card: 'summary_large_image', title: t, description: aciklama(s.a) },
  };
}

export default function PaylasimSayfasi({ params }: PageProps<'/a/[anahtar]'>) {
  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <Link href="/" aria-label="Lykiva ana sayfa" className={styles.brand}>
          <Logo size={26} />
        </Link>
      </header>
      <main>
        <Suspense fallback={<Iskelet />}>
          <Icerik params={params} />
        </Suspense>
        <section className={styles.cta} aria-label="Lykiva hakkında">
          <p className={styles.ctaTitle}>Rotanı kaydet. Birlikte yol al.</p>
          <p className={styles.ctaBody}>
            Lykiva ile bisiklet, koşu ve doğa yürüyüşlerini kaydet; rotalarını gruplarınla paylaş. Evinin konumu gizli kalır.
          </p>
          <p className={styles.ctaSoon}>Yakında App Store ve Google Play&apos;de</p>
        </section>
      </main>
    </div>
  );
}

async function Icerik({ params }: { params: PageProps<'/a/[anahtar]'>['params'] }) {
  const { anahtar } = await params;
  const s = await paylasilanAktivite(anahtar);
  if (s.durum === 'yok') notFound();
  if (s.durum !== 'var') {
    return (
      <div className={styles.durum} role="alert">
        <h1 className={styles.title}>Şu an açılamadı</h1>
        <p>{s.durum === 'ayarsiz' ? 'Paylaşım sayfası henüz yapılandırılmadı.' : 'Sunucuya ulaşılamadı. Biraz sonra tekrar dene.'}</p>
      </div>
    );
  }
  return <Aktivite a={s.a} />;
}

function Aktivite({ a }: { a: PaylasilanAktivite }) {
  const t = baslik(a);
  return (
    <article>
      <p className={styles.meta}>
        <span className={styles.owner}>{a.owner_name}</span> · {ACTIVITY_LABELS[a.activity]}
      </p>
      <h1 className={styles.title}>{t}</h1>
      <p className={styles.when}>{tarihMetni(a.started_at)}</p>

      <Harita a={a} baslik={t} />

      <dl className={styles.stats}>
        {istatistikler(a).map((i) => (
          <div key={i.etiket} className={styles.stat}>
            <dt>{i.etiket}</dt>
            <dd>
              {i.deger}
              {i.birim ? <span className={styles.unit}> {i.birim}</span> : null}
            </dd>
          </div>
        ))}
      </dl>

      <Profil a={a} />

      <p className={styles.social}>
        <span>{a.like_count} beğeni</span>
        <span aria-hidden="true">·</span>
        <span>{a.comment_count} yorum</span>
        {a.stop_count ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{a.stop_count} mola</span>
          </>
        ) : null}
      </p>
    </article>
  );
}

function Harita({ a, baslik: t }: { a: PaylasilanAktivite; baslik: string }) {
  const W = 720;
  const H = 420;
  if (!a.track || a.track.length < 2) {
    return (
      <div className={styles.mapEmpty}>
        <p>{a.endpoints_hidden ? 'Bu aktivite kısa olduğu için rota gizlilik nedeniyle gösterilmiyor.' : 'Bu aktivitenin rotası yok.'}</p>
      </div>
    );
  }
  const iz = izCiz(a.track, W, H, 36);
  return (
    <figure className={styles.map}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${t} rotası, ${formatKm(a.distance_m)} kilometre`}>
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
      {a.endpoints_hidden ? <figcaption>Başlangıç ve bitiş noktaları gizlilik için gösterilmiyor.</figcaption> : null}
    </figure>
  );
}

function Profil({ a }: { a: PaylasilanAktivite }) {
  if (a.elevation.length < 2) return null;
  const W = 720;
  const H = 120;
  const p = profilCiz(a.elevation, W, H);
  return (
    <section className={styles.profile} aria-label="Yükseklik profili">
      <div className={styles.profileHead}>
        <h2>Yükseklik</h2>
        <span>
          ↑ {Math.round(a.elevation_gain_m ?? 0)} m · ↓ {Math.round(a.elevation_loss_m ?? 0)} m
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`En düşük ${p.zMin} metre, en yüksek ${p.zMax} metre`}>
        <path d={p.alan} fill="var(--sea-soft)" />
        <path d={p.cizgi} fill="none" stroke="var(--sea)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className={styles.profileAxis}>
        <span>0 km</span>
        <span>
          {p.zMin}–{p.zMax} m
        </span>
        <span>{formatKm(p.dMax)} km</span>
      </div>
    </section>
  );
}

function Iskelet() {
  return (
    <div aria-busy="true" aria-label="Yükleniyor">
      <div className={`${styles.skel} ${styles.skelLine}`} style={{ width: '40%' }} />
      <div className={`${styles.skel} ${styles.skelTitle}`} />
      <div className={`${styles.skel} ${styles.skelMap}`} />
    </div>
  );
}
