import { ACTIVITY_LABELS, type ActivityType } from '@lykiva/shared';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { liste, yonetimRpc, type MeydanOkumaSatiri, type Sayfa } from '@/lib/yonetim/veri';
import { meydanOkumaSil } from '../actions';
import styles from '../admin.module.css';
import { OnayliDugme } from '../OnayliDugme';
import { Arama, Baslik, Bos, Etiket, gun, Sayfalama, sayi, Yukleniyor } from '../ui';
import { MeydanOkumaFormu } from './MeydanOkumaFormu';

export default function MeydanOkumalar({ searchParams }: PageProps<'/admin/meydan-okumalar'>) {
  return (
    <>
      <Baslik alt="Herkese açık meydan okumalar buradan açılır; grup meydan okumalarını grup üyeleri uygulamadan açar.">Meydan okumalar</Baslik>
      <Suspense fallback={<Yukleniyor />}>
        <Form />
      </Suspense>
      <Suspense fallback={<Yukleniyor />}>
        <Icerik searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/** "2026-11-12" biçiminde, Türkiye saatine göre */
const isoGun = (t: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);

async function Form() {
  await connection();
  const simdi = new Date();
  const [y, a] = isoGun(simdi).split('-').map(Number);
  // Ayın son günü: bir sonraki ayın 0. günü (UTC'de hesap, yalnızca tarih)
  const ayinSonu = new Date(Date.UTC(y, a, 0)).toISOString().slice(0, 10);
  return (
    <section className={styles.bolum}>
      <h2 className={styles.bolumBaslik}>Yeni meydan okuma</h2>
      <MeydanOkumaFormu bugun={isoGun(simdi)} ayinSonu={ayinSonu} />
    </section>
  );
}

function hedefMetni(s: MeydanOkumaSatiri): string {
  switch (s.olcu) {
    case 'mesafe':
      return `${sayi(Math.round(s.hedef / 100) / 10)} km`;
    case 'sure':
      return `${sayi(Math.round(s.hedef / 360) / 10)} saat`;
    case 'sayi':
      return `${sayi(s.hedef)} aktivite`;
    case 'tirmanis':
      return `${sayi(s.hedef)} m tırmanış`;
  }
}

async function Icerik({ searchParams }: { searchParams: PageProps<'/admin/meydan-okumalar'>['searchParams'] }) {
  const { q, sayfa } = await liste(searchParams);
  const s = await yonetimRpc<Sayfa<MeydanOkumaSatiri>>('yonetim_meydan_okumalar', { arama: q || null, sayfa });
  return (
    <>
      <Arama q={q} yer="Meydan okuma ya da grup adı" />
      {s.satirlar.length === 0 ? (
        <Bos>{q ? 'Bu aramayla meydan okuma yok.' : 'Henüz meydan okuma yok.'}</Bos>
      ) : (
        <div className={styles.tabloKap}>
          <table className={styles.tablo}>
            <thead>
              <tr>
                <th>Meydan okuma</th>
                <th>Tarih</th>
                <th>Nerede</th>
                <th>Açan</th>
                <th className={styles.sag}>Katılımcı</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {s.satirlar.map((m) => {
                const bitti = m.durum === 'bitti';
                const baslamadi = m.durum === 'baslamadi';
                return (
                  <tr key={m.id}>
                    <td>
                      {m.baslik}
                      <span className={styles.ikincil}>
                        {hedefMetni(m)}
                        {m.turler.length ? ` · ${m.turler.map((t) => ACTIVITY_LABELS[t as ActivityType] ?? t).join(', ')}` : ''}
                      </span>
                    </td>
                    <td>
                      {gun(m.baslangic)} – {gun(new Date(Date.parse(m.bitis) - 1).toISOString())}
                      <span className={styles.ikincil}>
                        <Etiket ton={bitti ? 'gri' : baslamadi ? 'koyu' : 'deniz'}>{bitti ? 'Bitti' : baslamadi ? 'Başlamadı' : 'Sürüyor'}</Etiket>
                      </span>
                    </td>
                    <td>{m.grup ? `Grup: ${m.grup}` : <Etiket ton="toprak">Herkese açık</Etiket>}</td>
                    <td>{m.olusturan ?? '–'}</td>
                    <td className={styles.sag}>{sayi(m.katilimci)}</td>
                    <td>
                      <form action={meydanOkumaSil} className={styles.islemler}>
                        <input type="hidden" name="id" value={m.id} />
                        <OnayliDugme etiket="Sil" onay={`"${m.baslik}" kalıcı olarak silinsin mi? Bütün katılımcılar için silinir. Geri alınamaz.`} tehlikeli />
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Sayfalama yol="/admin/meydan-okumalar" q={q} sayfa={sayfa} toplam={s.toplam} />
    </>
  );
}
