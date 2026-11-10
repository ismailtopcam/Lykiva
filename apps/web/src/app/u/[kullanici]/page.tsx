import { ACTIVITY_LABELS, formatDuration, formatKm, formatMeters } from '@lykiva/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { Logo } from '@/components/Logo';
import { herkeseAcikProfil, kisaTarih, uyelikMetni, type HerkeseAcikProfil } from '@/lib/profil';
import styles from './profil.module.css';

// Profiller arama motorlarında listelenmez (bağlantıyı bilen görür)
const GIZLI = { index: false, follow: false } as const;

export async function generateMetadata({ params }: PageProps<'/u/[kullanici]'>): Promise<Metadata> {
  const { kullanici } = await params;
  const s = await herkeseAcikProfil(kullanici);
  if (s.durum !== 'var') return { title: 'Profil', robots: GIZLI };
  const t = `${s.p.display_name} (@${s.p.username})`;
  const aciklama = `${s.p.aktivite_sayisi} herkese açık aktivite · ${formatKm(s.p.toplam_km * 1000)} km${s.p.city ? ` · ${s.p.city}` : ''}`;
  return {
    title: t,
    description: aciklama,
    robots: GIZLI,
    openGraph: { title: t, description: aciklama, type: 'profile', siteName: 'Lykiva', locale: 'tr_TR' },
  };
}

export default function ProfilSayfasi({ params }: PageProps<'/u/[kullanici]'>) {
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
          <p className={styles.ctaBody}>Lykiva ile bisiklet, koşu ve doğa yürüyüşlerini kaydet; rotalarını gruplarınla paylaş.</p>
          <p className={styles.ctaSoon}>Yakında App Store ve Google Play&apos;de</p>
        </section>
      </main>
    </div>
  );
}

async function Icerik({ params }: { params: PageProps<'/u/[kullanici]'>['params'] }) {
  const { kullanici } = await params;
  const s = await herkeseAcikProfil(kullanici);
  if (s.durum === 'yok') notFound();
  if (s.durum !== 'var') {
    return (
      <div className={styles.durum} role="alert">
        <h1 className={styles.name}>Şu an açılamadı</h1>
        <p>{s.durum === 'ayarsiz' ? 'Profil sayfası henüz yapılandırılmadı.' : 'Sunucuya ulaşılamadı. Biraz sonra tekrar dene.'}</p>
      </div>
    );
  }
  return <Profil p={s.p} />;
}

function basHarfler(ad: string) {
  return ad
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 2)
    .toLocaleUpperCase('tr-TR');
}

function Profil({ p }: { p: HerkeseAcikProfil }) {
  const sayilar: [string, string][] = [
    [String(p.aktivite_sayisi), 'aktivite'],
    [formatKm(p.toplam_km * 1000), 'km'],
    [String(p.takipci), 'takipçi'],
    [String(p.takip), 'takip'],
  ];
  return (
    <article>
      <div className={styles.kimlik}>
        <div className={styles.avatar} aria-hidden="true">
          {basHarfler(p.display_name)}
        </div>
        <div>
          <h1 className={styles.name}>{p.display_name}</h1>
          <p className={styles.handle}>
            @{p.username}
            {p.city ? ` · ${p.city}` : ''} · {uyelikMetni(p.created_at)} tarihinden beri
          </p>
        </div>
      </div>
      {p.bio ? <p className={styles.bio}>{p.bio}</p> : null}

      <dl className={styles.sayilar}>
        {sayilar.map(([n, l]) => (
          <div key={l}>
            <dd>{n}</dd>
            <dt>{l}</dt>
          </div>
        ))}
      </dl>

      <section aria-labelledby="son-aktiviteler">
        <h2 id="son-aktiviteler" className={styles.bolum}>
          Son herkese açık aktiviteler
        </h2>
        {p.aktiviteler.length === 0 ? (
          <p className={styles.bos}>Henüz herkese açık bir aktivite yok.</p>
        ) : (
          <ul className={styles.liste}>
            {p.aktiviteler.map((a, i) => (
              <li key={`${a.started_at}-${i}`} className={styles.satir}>
                <div className={styles.satirUst}>
                  <span className={styles.satirAd}>{a.title?.trim() || ACTIVITY_LABELS[a.activity]}</span>
                  <span className={styles.satirTarih}>{kisaTarih(a.started_at)}</span>
                </div>
                <p className={styles.satirAlt}>
                  {ACTIVITY_LABELS[a.activity]} · {formatKm(a.distance_m)} km · {formatDuration(a.moving_time_s)} · ↑ {formatMeters(Math.round(a.elevation_gain_m ?? 0))} m
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.not}>Takipçilere ve gruplara açık aktiviteler yalnızca uygulamada görünür.</p>
      </section>
    </article>
  );
}

function Iskelet() {
  return (
    <div aria-busy="true" aria-label="Yükleniyor">
      <div className={`${styles.skel}`} style={{ height: 76, width: '60%', marginTop: 24 }} />
      <div className={`${styles.skel}`} style={{ height: 64, marginTop: 20 }} />
      <div className={`${styles.skel}`} style={{ height: 220, marginTop: 20 }} />
    </div>
  );
}
