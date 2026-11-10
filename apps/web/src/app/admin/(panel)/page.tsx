import Link from 'next/link';
import { Suspense } from 'react';

import { yonetimRpc, type Ozet } from '@/lib/yonetim/veri';
import styles from './admin.module.css';
import { Baslik, sayi, Yukleniyor } from './ui';

export default function GenelBakis() {
  return (
    <>
      <Baslik alt="Son 7 gün ve son 14 günün günlük hareketi">Genel bakış</Baslik>
      <Suspense fallback={<Yukleniyor />}>
        <Icerik />
      </Suspense>
    </>
  );
}

const gunAdi = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'numeric' });

async function Icerik() {
  const o = await yonetimRpc<Ozet>('yonetim_ozet');
  const kartlar: { ad: string; deger: number; href?: string; vurgu?: boolean }[] = [
    { ad: 'Açık şikayet', deger: o.sikayet_acik, href: '/admin/sikayetler', vurgu: o.sikayet_acik > 0 },
    { ad: 'Kullanıcı (giriş yapmış)', deger: o.kullanici, href: '/admin/kullanicilar' },
    { ad: 'Yeni kullanıcı · 7 gün', deger: o.yeni_kullanici_7g },
    { ad: 'Geçici hesap', deger: o.gecici },
    { ad: 'Aktif · 7 gün', deger: o.aktif_7g },
    { ad: 'Aktivite · 7 gün', deger: o.aktivite_7g, href: '/admin/aktiviteler' },
    { ad: 'Toplam aktivite', deger: o.aktivite },
    { ad: 'Herkese açık rota', deger: o.rota_acik, href: '/admin/rotalar' },
    { ad: 'Topluluk', deger: o.topluluk, href: '/admin/topluluklar' },
    { ad: 'Özel grup', deger: o.grup },
    { ad: 'Yaklaşan etkinlik', deger: o.etkinlik_yaklasan, href: '/admin/etkinlikler' },
    { ad: 'Şu an canlı konum', deger: o.canli },
  ];
  const enCok = Math.max(1, ...o.gunluk.map((g) => Math.max(g.aktivite, g.kayit)));
  return (
    <>
      <div className={styles.kartlar}>
        {kartlar.map((k) => {
          const icerik = (
            <>
              <span className={styles.kartSayi}>{sayi(k.deger)}</span>
              <span className={styles.kartAd}>{k.ad}</span>
            </>
          );
          const sinif = k.vurgu ? `${styles.kart} ${styles.kartVurgu}` : styles.kart;
          return k.href ? (
            <Link key={k.ad} href={k.href} className={sinif}>
              {icerik}
            </Link>
          ) : (
            <div key={k.ad} className={sinif}>
              {icerik}
            </div>
          );
        })}
      </div>

      <section className={styles.bolum} aria-labelledby="gunluk-baslik">
        <h2 id="gunluk-baslik" className={styles.bolumBaslik}>
          Son 14 gün
        </h2>
        <div className={styles.grafik} role="img" aria-label={`Son 14 günde toplam ${o.gunluk.reduce((t, g) => t + g.aktivite, 0)} aktivite, ${o.gunluk.reduce((t, g) => t + g.kayit, 0)} yeni kullanıcı`}>
          {o.gunluk.map((g) => (
            <div key={g.gun} className={styles.cubukKap} title={`${g.gun}: ${g.aktivite} aktivite, ${g.kayit} yeni kullanıcı`}>
              <div className={styles.cubuklar}>
                <div className={styles.cubukAktivite} style={{ height: `${(g.aktivite / enCok) * 100}%` }} />
                <div className={styles.cubukKayit} style={{ height: `${(g.kayit / enCok) * 100}%` }} />
              </div>
              <span className={styles.cubukGun}>{gunAdi.format(new Date(`${g.gun}T12:00:00`))}</span>
            </div>
          ))}
        </div>
        <div className={styles.lejant}>
          <span style={{ color: 'var(--terra)' }}>Aktivite</span>
          <span style={{ color: 'var(--sea)' }}>Yeni kullanıcı</span>
        </div>
      </section>
    </>
  );
}
