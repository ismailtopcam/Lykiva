import { ACTIVITY_LABELS, formatDuration, formatKm, type ActivityType } from '@lykiva/shared';
import { Suspense } from 'react';

import { liste, yonetimRpc, type AktiviteSatiri, type Sayfa } from '@/lib/yonetim/veri';
import { aktiviteSil } from '../actions';
import styles from '../admin.module.css';
import { OnayliDugme } from '../OnayliDugme';
import { Arama, Baslik, Bos, Etiket, GORUNURLUK, Sayfalama, tarih, Yukleniyor } from '../ui';

export default function Aktiviteler({ searchParams }: PageProps<'/admin/aktiviteler'>) {
  return (
    <>
      <Baslik alt="Tüm kayıtlar, yeniden eskiye. Başlık ya da sahibinin adıyla ara.">Aktiviteler</Baslik>
      <Suspense fallback={<Yukleniyor />}>
        <Icerik searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Icerik({ searchParams }: { searchParams: PageProps<'/admin/aktiviteler'>['searchParams'] }) {
  const { q, sayfa } = await liste(searchParams);
  const s = await yonetimRpc<Sayfa<AktiviteSatiri>>('yonetim_aktiviteler', { arama: q || null, sayfa });
  return (
    <>
      <Arama q={q} yer="Başlık ya da kişi" />
      {s.satirlar.length === 0 ? (
        <Bos>{q ? 'Bu aramayla aktivite yok.' : 'Henüz aktivite yok.'}</Bos>
      ) : (
        <div className={styles.tabloKap}>
          <table className={styles.tablo}>
            <thead>
              <tr>
                <th>Aktivite</th>
                <th>Sahibi</th>
                <th>Tarih</th>
                <th className={styles.sag}>Mesafe</th>
                <th className={styles.sag}>Süre</th>
                <th>Görünürlük</th>
                <th className={styles.sag}>Beğeni / yorum</th>
                <th className={styles.sag}>Şikayet</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {s.satirlar.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.title || ACTIVITY_LABELS[a.activity as ActivityType]}
                    <span className={styles.ikincil}>{ACTIVITY_LABELS[a.activity as ActivityType]}</span>
                  </td>
                  <td>
                    {a.owner_name}
                    <span className={styles.ikincil}>@{a.owner_username}</span>
                  </td>
                  <td>{tarih(a.started_at)}</td>
                  <td className={styles.sag}>{formatKm(a.distance_m)} km</td>
                  <td className={styles.sag}>{formatDuration(a.moving_time_s)}</td>
                  <td>
                    <Etiket ton={a.visibility === 'public' ? 'deniz' : 'gri'}>{GORUNURLUK[a.visibility] ?? a.visibility}</Etiket>
                  </td>
                  <td className={styles.sag}>
                    {a.begeni} / {a.yorum}
                  </td>
                  <td className={styles.sag}>{a.sikayet ? <Etiket ton="toprak">{a.sikayet}</Etiket> : '–'}</td>
                  <td>
                    <form action={aktiviteSil} className={styles.islemler}>
                      <input type="hidden" name="id" value={a.id} />
                      <OnayliDugme etiket="Sil" onay={`"${a.title || 'Aktivite'}" kalıcı olarak silinsin mi? Geri alınamaz.`} tehlikeli />
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Sayfalama yol="/admin/aktiviteler" q={q} sayfa={sayfa} toplam={s.toplam} />
    </>
  );
}
