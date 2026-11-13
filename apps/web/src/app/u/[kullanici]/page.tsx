import { activityLabel, formatDuration, formatKm, formatMeters, type Dil, kmUnit, mUnit } from '@lykiva/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { Logo } from '@/components/Logo';
import { istekDili, OG_YEREL } from '@/lib/dil';
import { herkeseAcikProfil, kisaTarih, uyelikMetni, type HerkeseAcikProfil } from '@/lib/profil';
import { metinler, type Metin } from '@/lib/sozluk';
import styles from './profil.module.css';

// Profiller arama motorlarında listelenmez (bağlantıyı bilen görür)
const GIZLI = { index: false, follow: false } as const;

export async function generateMetadata({ params, searchParams }: PageProps<'/u/[kullanici]'>): Promise<Metadata> {
  const { kullanici } = await params;
  const dil = await istekDili(searchParams);
  const m = metinler(dil);
  const s = await herkeseAcikProfil(kullanici);
  if (s.durum !== 'var') return { title: m('profil'), robots: GIZLI };
  const t = `${s.p.display_name} (@${s.p.username})`;
  const aciklama = m('profil_aciklama', { n: s.p.aktivite_sayisi, km: formatKm(s.p.toplam_km * 1000, dil), sehir: s.p.city ? ` · ${s.p.city}` : '' });
  return {
    title: t,
    description: aciklama,
    robots: GIZLI,
    openGraph: { title: t, description: aciklama, type: 'profile', siteName: 'Lykiva', locale: OG_YEREL[dil] },
  };
}

export default function ProfilSayfasi({ params, searchParams }: PageProps<'/u/[kullanici]'>) {
  return (
    <Suspense fallback={<Iskelet />}>
      <Sayfa params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Sayfa({ params, searchParams }: Pick<PageProps<'/u/[kullanici]'>, 'params' | 'searchParams'>) {
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
          <p className={styles.ctaBody}>{m('cta_profil')}</p>
          <p className={styles.ctaSoon}>{m('yakinda')}</p>
        </section>
      </main>
    </div>
  );
}

async function Icerik({ params, dil, m }: { params: PageProps<'/u/[kullanici]'>['params']; dil: Dil; m: Metin }) {
  const { kullanici } = await params;
  const s = await herkeseAcikProfil(kullanici);
  if (s.durum === 'yok') notFound();
  if (s.durum !== 'var') {
    return (
      <div className={styles.durum} role="alert">
        <h1 className={styles.name}>{m('acilamadi')}</h1>
        <p>{s.durum === 'ayarsiz' ? m('profil_ayarsiz') : m('sunucu_yok')}</p>
      </div>
    );
  }
  return <Profil p={s.p} dil={dil} m={m} />;
}

function basHarfler(ad: string) {
  return ad
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 2)
    .toLocaleUpperCase('tr-TR');
}

function Profil({ p, dil, m }: { p: HerkeseAcikProfil; dil: Dil; m: Metin }) {
  const sayilar: [string, string][] = [
    [String(p.aktivite_sayisi), m('aktivite_sayisi', { n: p.aktivite_sayisi })],
    [formatKm(p.toplam_km * 1000, dil), kmUnit(dil)],
    [String(p.takipci), m('takipci', { n: p.takipci })],
    [String(p.takip), m('takip', { n: p.takip })],
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
            {p.city ? ` · ${p.city}` : ''} · {m('uyelik', { tarih: uyelikMetni(p.created_at, dil) })}
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
          {m('son_aktiviteler')}
        </h2>
        {p.aktiviteler.length === 0 ? (
          <p className={styles.bos}>{m('aktivite_yok')}</p>
        ) : (
          <ul className={styles.liste}>
            {p.aktiviteler.map((a, i) => (
              <li key={`${a.started_at}-${i}`} className={styles.satir}>
                <div className={styles.satirUst}>
                  <span className={styles.satirAd}>{a.title?.trim() || activityLabel(a.activity, dil)}</span>
                  <span className={styles.satirTarih}>{kisaTarih(a.started_at, dil)}</span>
                </div>
                <p className={styles.satirAlt}>
                  {activityLabel(a.activity, dil)} · {formatKm(a.distance_m, dil)} {kmUnit(dil)} · {formatDuration(a.moving_time_s)} · ↑{' '}
                  {formatMeters(Math.round(a.elevation_gain_m ?? 0), dil)} {mUnit(dil)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.not}>{m('yalniz_uygulamada')}</p>
      </section>
    </article>
  );
}

function Iskelet() {
  return (
    <div className={styles.page} aria-busy="true">
      <div className={`${styles.skel}`} style={{ height: 76, width: '60%', marginTop: 24 }} />
      <div className={`${styles.skel}`} style={{ height: 64, marginTop: 20 }} />
      <div className={`${styles.skel}`} style={{ height: 220, marginTop: 20 }} />
    </div>
  );
}
