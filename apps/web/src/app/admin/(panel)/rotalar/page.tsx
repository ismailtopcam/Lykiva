import { ACTIVITY_LABELS, formatKm, type ActivityType } from '@lykiva/shared';
import { Suspense } from 'react';

import { liste, yonetimRpc, type RotaSatiri, type Sayfa } from '@/lib/yonetim/veri';
import { rotaGizle } from '../actions';
import styles from '../admin.module.css';
import { OnayliDugme } from '../OnayliDugme';
import { Arama, Baslik, Bos, Etiket, gun, GORUNURLUK, Sayfalama, Yukleniyor } from '../ui';

export default function Rotalar({ searchParams }: PageProps<'/admin/rotalar'>) {
  return (
    <>
      <Baslik alt="Herkese açık bir rota sorunluysa (tehlikeli, yanıltıcı) herkese kapatabilirsin; sahibi görmeye devam eder.">Rotalar</Baslik>
      <Suspense fallback={<Yukleniyor />}>
        <Icerik searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Icerik({ searchParams }: { searchParams: PageProps<'/admin/rotalar'>['searchParams'] }) {
  const { q, sayfa } = await liste(searchParams);
  const s = await yonetimRpc<Sayfa<RotaSatiri>>('yonetim_rotalar', { arama: q || null, sayfa });
  return (
    <>
      <Arama q={q} yer="Rota adı ya da kişi" />
      {s.satirlar.length === 0 ? (
        <Bos>{q ? 'Bu aramayla rota yok.' : 'Henüz rota yok.'}</Bos>
      ) : (
        <div className={styles.tabloKap}>
          <table className={styles.tablo}>
            <thead>
              <tr>
                <th>Rota</th>
                <th>Sahibi</th>
                <th>Oluşturuldu</th>
                <th className={styles.sag}>Mesafe</th>
                <th className={styles.sag}>Tırmanış</th>
                <th>Görünürlük</th>
                <th className={styles.sag}>Şikayet</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {s.satirlar.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.name}
                    <span className={styles.ikincil}>{ACTIVITY_LABELS[r.activity as ActivityType]}</span>
                  </td>
                  <td>{r.owner_name}</td>
                  <td>{gun(r.created_at)}</td>
                  <td className={styles.sag}>{formatKm(r.distance_m)} km</td>
                  <td className={styles.sag}>{Math.round(r.elevation_gain_m ?? 0)} m</td>
                  <td>
                    <Etiket ton={r.visibility === 'public' ? 'deniz' : 'gri'}>{GORUNURLUK[r.visibility] ?? r.visibility}</Etiket>
                  </td>
                  <td className={styles.sag}>{r.sikayet ? <Etiket ton="toprak">{r.sikayet}</Etiket> : '–'}</td>
                  <td>
                    {r.visibility === 'public' ? (
                      <form action={rotaGizle} className={styles.islemler}>
                        <input type="hidden" name="id" value={r.id} />
                        <OnayliDugme etiket="Herkese kapat" onay={`"${r.name}" yalnızca sahibine görünür olacak. Devam edilsin mi?`} tehlikeli />
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Sayfalama yol="/admin/rotalar" q={q} sayfa={sayfa} toplam={s.toplam} />
    </>
  );
}
