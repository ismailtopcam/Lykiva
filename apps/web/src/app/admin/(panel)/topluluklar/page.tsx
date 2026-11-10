import { Suspense } from 'react';

import { liste, yonetimRpc, type GrupSatiri, type Sayfa } from '@/lib/yonetim/veri';
import { grupSil } from '../actions';
import styles from '../admin.module.css';
import { OnayliDugme } from '../OnayliDugme';
import { Arama, Baslik, Bos, Etiket, gun, Sayfalama, sayi, Yukleniyor } from '../ui';

export default function Topluluklar({ searchParams }: PageProps<'/admin/topluluklar'>) {
  return (
    <>
      <Baslik alt="Açık topluluklar ve özel gruplar. Grup silinince üyelikleri, mesajları ve etkinlikleri de silinir.">Gruplar & topluluklar</Baslik>
      <Suspense fallback={<Yukleniyor />}>
        <Icerik searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Icerik({ searchParams }: { searchParams: PageProps<'/admin/topluluklar'>['searchParams'] }) {
  const { q, sayfa } = await liste(searchParams);
  const s = await yonetimRpc<Sayfa<GrupSatiri>>('yonetim_gruplar', { arama: q || null, sayfa });
  return (
    <>
      <Arama q={q} yer="Grup adı ya da şehir" />
      {s.satirlar.length === 0 ? (
        <Bos>{q ? 'Bu aramayla grup yok.' : 'Henüz grup yok.'}</Bos>
      ) : (
        <div className={styles.tabloKap}>
          <table className={styles.tablo}>
            <thead>
              <tr>
                <th>Grup</th>
                <th>Tür</th>
                <th>Kuran</th>
                <th>Kuruldu</th>
                <th className={styles.sag}>Üye</th>
                <th className={styles.sag}>Mesaj · 7 gün</th>
                <th className={styles.sag}>Şikayet</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {s.satirlar.map((g) => (
                <tr key={g.id}>
                  <td>
                    {g.name}
                    {g.city ? <span className={styles.ikincil}>{g.city}</span> : null}
                  </td>
                  <td>
                    <Etiket ton={g.is_community ? 'deniz' : 'gri'}>{g.is_community ? 'Topluluk' : 'Grup'}</Etiket>{' '}
                    {g.is_private ? <Etiket>Özel</Etiket> : g.requires_approval ? <Etiket>Onaylı</Etiket> : <Etiket>Açık</Etiket>}
                  </td>
                  <td>{g.kuran}</td>
                  <td>{gun(g.created_at)}</td>
                  <td className={styles.sag}>{sayi(g.uye)}</td>
                  <td className={styles.sag}>{sayi(g.mesaj_7g)}</td>
                  <td className={styles.sag}>{g.sikayet ? <Etiket ton="toprak">{g.sikayet}</Etiket> : '–'}</td>
                  <td>
                    <form action={grupSil} className={styles.islemler}>
                      <input type="hidden" name="id" value={g.id} />
                      <OnayliDugme etiket="Sil" onay={`"${g.name}" (${g.uye} üye) mesajları ve etkinlikleriyle kalıcı olarak silinsin mi? Geri alınamaz.`} tehlikeli />
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Sayfalama yol="/admin/topluluklar" q={q} sayfa={sayfa} toplam={s.toplam} />
    </>
  );
}
