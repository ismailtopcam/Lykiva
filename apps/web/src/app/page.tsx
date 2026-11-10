import Link from 'next/link';

import { Logo } from '@/components/Logo';
import styles from './page.module.css';

const features = [
  {
    title: 'Her anı kaydet',
    body: 'Anlık hız, yapılan ve kalan mesafe, ortalama hızına göre varış süresi. Molaların, en yüksek ve en düşük hızın, inişli çıkışlı haritada rotanın tamamı.',
    tone: 'terra',
  },
  {
    title: 'Rotanı çiz, paylaş',
    body: 'Patikaya ya da yola yapışan rota çizimi, zemin ve tırmanış bilgisi. Rotanı istediğin gruplarla ve kişilerle paylaş, birlikte düzenleyin.',
    tone: 'sea',
  },
  {
    title: 'Birlikte yol al',
    body: 'Gruplar ve topluluklar kur, mesajlaş, etkinlik düzenle. Yoldaki arkadaşlarını canlı haritada takip et.',
    tone: 'ink',
  },
  {
    title: 'Paylaşmaya değer',
    body: 'Aktiviteni ve birlikte yaptığın kişileri hazır kart şablonlarıyla hikâyende, sohbetlerinde ve akışta paylaş. Evinin konumu gizli kalır.',
    tone: 'sand',
  },
] as const;

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <Link href="/" aria-label="Lykiva ana sayfa" className={styles.brand}>
          <Logo />
        </Link>
        <nav aria-label="Sayfa içi" className={styles.navLinks}>
          <a href="#ozellikler">Özellikler</a>
        </nav>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <p className={styles.eyebrow}>Bisiklet · Koşu · Yürüyüş · Doğa sporları</p>
            <h1 className={styles.title}>Rotanı kaydet. Birlikte yol al.</h1>
            <p className={styles.lead}>
              Aktivitelerini takip et, rotalarını paylaş, gruplarınla etkinlik düzenle. Likya&apos;nın patikalarından
              ilham alan, topluluğu merkeze koyan bir uygulama.
            </p>
            <div className={styles.ctaRow}>
              <span className={styles.ctaSoon}>Yakında App Store ve Google Play&apos;de</span>
              <a className={styles.ctaGhost} href="#ozellikler">
                Neler yapabilirsin?
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
              <span className={styles.liveLabel}>Anlık hız</span>
              <span className={styles.liveValue}>
                24,6 <small>km/sa</small>
              </span>
              <span className={styles.liveMeta}>Kalan 16,2 km · varışa 58 dk</span>
            </div>
          </div>
        </section>

        <section id="ozellikler" className={styles.features} aria-labelledby="ozellikler-baslik">
          <h2 id="ozellikler-baslik" className={styles.sectionTitle}>
            Takipten fazlası
          </h2>
          <div className={styles.grid}>
            {features.map((f) => (
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
        <nav aria-label="Yasal" className={styles.footerLinks}>
          <Link href="/gizlilik">Gizlilik</Link>
          <Link href="/kosullar">Koşullar</Link>
          <Link href="/hesap-silme">Hesap silme</Link>
        </nav>
        <span>© 2026 Lykiva</span>
      </footer>
    </div>
  );
}
