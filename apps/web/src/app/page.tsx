import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { Logo } from '@/components/Logo';
import { istekDili, OG_YEREL } from '@/lib/dil';
import { metinler, type Metin } from '@/lib/sozluk';
import styles from './page.module.css';

const features = (m: Metin) =>
  [
    { title: m('ozellik1_baslik'), body: m('ozellik1'), tone: 'terra' },
    { title: m('ozellik2_baslik'), body: m('ozellik2'), tone: 'sea' },
    { title: m('ozellik3_baslik'), body: m('ozellik3'), tone: 'ink' },
    { title: m('ozellik4_baslik'), body: m('ozellik4'), tone: 'sand' },
  ] as const;

export async function generateMetadata({ searchParams }: PageProps<'/'>): Promise<Metadata> {
  const dil = await istekDili(searchParams);
  const m = metinler(dil);
  return { title: { absolute: m('site_baslik') }, description: m('site_aciklama'), openGraph: { locale: OG_YEREL[dil] } };
}

export default function Home({ searchParams }: PageProps<'/'>) {
  // Dil isteğe göre (Accept-Language / ?dil=) seçildiği için içerik istekte çizilir
  return (
    <Suspense fallback={null}>
      <Ana searchParams={searchParams} />
    </Suspense>
  );
}

async function Ana({ searchParams }: { searchParams: PageProps<'/'>['searchParams'] }) {
  const dil = await istekDili(searchParams);
  const m = metinler(dil);
  return (
    <div className={styles.page} lang={dil}>
      <header className={styles.nav}>
        <Link href="/" aria-label={m('ana_sayfa')} className={styles.brand}>
          <Logo />
        </Link>
        <nav aria-label={m('sayfa_ici')} className={styles.navLinks}>
          <a href="#ozellikler">{m('ozellikler')}</a>
        </nav>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <p className={styles.eyebrow}>{m('turler')}</p>
            <h1 className={styles.title}>{m('slogan')}</h1>
            <p className={styles.lead}>{m('giris_metni')}</p>
            <div className={styles.ctaRow}>
              <span className={styles.ctaSoon}>{m('yakinda')}</span>
              <a className={styles.ctaGhost} href="#ozellikler">
                {m('neler_yapabilirsin')}
              </a>
            </div>
          </div>

          <div className={styles.heroArt} aria-hidden="true">
            <svg viewBox="0 0 520 420" className={styles.heroSvg}>
              <rect width="520" height="420" rx="28" fill="var(--land)" />
              <path d="M0 300 C 80 280, 150 330, 230 360 S 400 400, 520 360 L520 420 L0 420Z" fill="var(--water)" />
              <g fill="none" stroke="#D3C7B0" strokeWidth="1.2">
                <path d="M230 120 C 280 60, 400 60, 440 120 S 420 230, 350 226 S 210 190, 230 120Z" />
                <path d="M266 130 C 296 94, 380 96, 404 134 S 390 206, 346 204 S 248 178, 266 130Z" />
                <path d="M300 140 C 316 120, 362 122, 372 144 S 360 182, 340 182 S 290 166, 300 140Z" />
                <path d="M40 140 C 80 80, 170 92, 182 150 S 140 240, 90 232 S 10 200, 40 140Z" />
                <path d="M70 148 C 96 112, 150 120, 156 156 S 126 214, 94 210 S 50 186, 70 148Z" />
              </g>
              <path d="M50 330 C 110 310, 140 260, 200 264 S 290 290, 330 236 S 400 160, 440 190 S 480 260, 500 250" fill="none" stroke="var(--surface)" strokeWidth="11" strokeLinecap="round" />
              <path d="M50 330 C 110 310, 140 260, 200 264 S 290 290, 330 236 S 400 160, 440 190 S 480 260, 500 250" fill="none" stroke="var(--terra)" strokeWidth="6" strokeLinecap="round" />
              <circle cx="50" cy="330" r="9" fill="var(--surface)" stroke="var(--sea)" strokeWidth="4" />
              <circle cx="500" cy="250" r="9" fill="var(--ink)" stroke="var(--surface)" strokeWidth="3" />
            </svg>
            <div className={styles.liveCard}>
              <span className={styles.liveDot} />
              <span className={styles.liveLabel}>{m('anlik_hiz')}</span>
              <span className={styles.liveValue}>
                {m('canli_ornek_hiz')} <small>{m('hiz_birimi')}</small>
              </span>
              <span className={styles.liveMeta}>{m('canli_ornek')}</span>
            </div>
          </div>
        </section>

        <section id="ozellikler" className={styles.features} aria-labelledby="ozellikler-baslik">
          <h2 id="ozellikler-baslik" className={styles.sectionTitle}>
            {m('takipten_fazlasi')}
          </h2>
          <div className={styles.grid}>
            {features(m).map((f) => (
              <article key={f.title} className={`${styles.card} ${styles[f.tone]}`}>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <Logo size={22} />
        <nav aria-label={m('yasal')} className={styles.footerLinks}>
          <Link href="/gizlilik">{m('gizlilik')}</Link>
          <Link href="/kosullar">{m('kosullar')}</Link>
          <Link href="/hesap-silme">{m('hesap_silme')}</Link>
        </nav>
        <span>© 2026 Lykiva</span>
      </footer>
    </div>
  );
}
