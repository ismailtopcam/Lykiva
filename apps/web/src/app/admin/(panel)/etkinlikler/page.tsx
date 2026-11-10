import { ACTIVITY_LABELS, type ActivityType } from '@lykiva/shared';
import Link from 'next/link';
import { Suspense } from 'react';

import { liste, yonetimRpc, type EtkinlikSatiri, type Sayfa } from '@/lib/yonetim/veri';
import { etkinlikSil } from '../actions';
import styles from '../admin.module.css';
import { OnayliDugme } from '../OnayliDugme';
import { Arama, Baslik, Bos, Etiket, GORUNURLUK, Sayfalama, tarih, Yukleniyor } from '../ui';

export default function Etkinlikler({ searchParams }: PageProps<'/admin/etkinlikler'>) {
  return (
    <>
      <Baslik alt="Yaklaşan ve geçmiş etkinlikler.">Etkinlikler</Baslik>
      <Suspense fallback={<Yukleniyor />}>
        <Icerik searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Icerik({ searchParams }: { searchParams: PageProps<'/admin/etkinlikler'>['searchParams'] }) {
  const { q, sayfa, sp } = await liste(searchParams);
  const gecmis = sp.gecmis === '1';
  const s = await yonetimRpc<Sayfa<EtkinlikSatiri>>('yonetim_etkinlikler', { arama: q || null, sayfa, gecmis });
  const ekstra = gecmis ? { gecmis: '1' } : undefined;
  return (
    <>
      <nav className={styles.sekmeler} aria-label="Etkinlik zamanı">
        <Link href="/admin/etkinlikler" aria-current={!gecmis ? 'page' : undefined} className={!gecmis ? `${styles.sekme} ${styles.sekmeAktif}` : styles.sekme}>
          Yaklaşan
        </Link>
        <Link href="/admin/etkinlikler?gecmis=1" aria-current={gecmis ? 'page' : undefined} className={gecmis ? `${styles.sekme} ${styles.sekmeAktif}` : styles.sekme}>
          Geçmiş
        </Link>
      </nav>
      <Arama q={q} yer="Etkinlik ya da grup adı" ekstra={ekstra} />
      {s.satirlar.length === 0 ? (
        <Bos>{q ? 'Bu aramayla etkinlik yok.' : gecmis ? 'Geçmiş etkinlik yok.' : 'Yaklaşan etkinlik yok.'}</Bos>
      ) : (
        <div className={styles.tabloKap}>
          <table className={styles.tablo}>
            <thead>
              <tr>
                <th>Etkinlik</th>
                <th>Zaman</th>
                <th>Grup</th>
                <th>Oluşturan</th>
                <th>Görünürlük</th>
                <th className={styles.sag}>Katılan</th>
                <th className={styles.sag}>Şikayet</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {s.satirlar.map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.title}
                    <span className={styles.ikincil}>
                      {ACTIVITY_LABELS[e.activity as ActivityType]}
                      {e.meeting_point_name ? ` · ${e.meeting_point_name}` : ''}
                    </span>
                  </td>
                  <td>{tarih(e.starts_at)}</td>
                  <td>{e.grup ?? '–'}</td>
                  <td>{e.olusturan}</td>
                  <td>
                    <Etiket ton={e.visibility === 'public' ? 'deniz' : 'gri'}>{GORUNURLUK[e.visibility] ?? e.visibility}</Etiket>
                  </td>
                  <td className={styles.sag}>
                    {e.katilan}
                    {e.capacity ? ` / ${e.capacity}` : ''}
                  </td>
                  <td className={styles.sag}>{e.sikayet ? <Etiket ton="toprak">{e.sikayet}</Etiket> : '–'}</td>
                  <td>
                    <form action={etkinlikSil} className={styles.islemler}>
                      <input type="hidden" name="id" value={e.id} />
                      <OnayliDugme etiket="Sil" onay={`"${e.title}" kalıcı olarak silinsin mi? Katılımcılar artık göremez. Geri alınamaz.`} tehlikeli />
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Sayfalama yol="/admin/etkinlikler" q={q} sayfa={sayfa} toplam={s.toplam} ekstra={ekstra} />
    </>
  );
}
