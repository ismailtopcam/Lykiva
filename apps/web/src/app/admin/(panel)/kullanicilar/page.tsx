import { Suspense } from 'react';

import { liste, yonetimRpc, type KullaniciSatiri, type Sayfa } from '@/lib/yonetim/veri';
import { engelDegistir, yetkiDegistir } from '../actions';
import styles from '../admin.module.css';
import { OnayliDugme } from '../OnayliDugme';
import { Arama, Baslik, Bos, Etiket, gun, Sayfalama, sayi, tarih, Yukleniyor } from '../ui';

export default function Kullanicilar({ searchParams }: PageProps<'/admin/kullanicilar'>) {
  return (
    <>
      <Baslik alt="Giriş yapmış hesaplar (geçici hesaplar sayılmaz). Ad, kullanıcı adı ya da e-postayla ara.">Kullanıcılar</Baslik>
      <Suspense fallback={<Yukleniyor />}>
        <Icerik searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Icerik({ searchParams }: { searchParams: PageProps<'/admin/kullanicilar'>['searchParams'] }) {
  const { q, sayfa } = await liste(searchParams);
  const s = await yonetimRpc<Sayfa<KullaniciSatiri>>('yonetim_kullanicilar', { arama: q || null, sayfa });
  return (
    <>
      <Arama q={q} yer="Ad, kullanıcı adı, e-posta" />
      {s.satirlar.length === 0 ? (
        <Bos>{q ? 'Bu aramayla kullanıcı yok.' : 'Henüz kullanıcı yok.'}</Bos>
      ) : (
        <div className={styles.tabloKap}>
          <table className={styles.tablo}>
            <thead>
              <tr>
                <th>Kullanıcı</th>
                <th>E-posta</th>
                <th>Katıldı</th>
                <th>Son giriş</th>
                <th className={styles.sag}>Aktivite</th>
                <th className={styles.sag}>Takipçi</th>
                <th className={styles.sag}>Şikayet</th>
                <th className={styles.sag}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {s.satirlar.map((k) => (
                <tr key={k.id}>
                  <td>
                    {k.display_name} {k.is_admin ? <Etiket ton="koyu">Yönetici</Etiket> : null}
                    {k.engelli ? <Etiket ton="toprak">Engelli</Etiket> : null}
                    <span className={styles.ikincil}>
                      @{k.username}
                      {k.city ? ` · ${k.city}` : ''}
                    </span>
                  </td>
                  <td>{k.email ?? '–'}</td>
                  <td>{gun(k.created_at)}</td>
                  <td>{tarih(k.last_sign_in_at)}</td>
                  <td className={styles.sag}>{sayi(k.aktivite)}</td>
                  <td className={styles.sag}>{sayi(k.takipci)}</td>
                  <td className={styles.sag}>{k.sikayet ? <Etiket ton="toprak">{k.sikayet}</Etiket> : '–'}</td>
                  <td className={styles.sag}>
                    <form action={yetkiDegistir} className={styles.islemler}>
                      <input type="hidden" name="id" value={k.id} />
                      <input type="hidden" name="yonetici" value={k.is_admin ? 'false' : 'true'} />
                      <OnayliDugme
                        etiket={k.is_admin ? 'Yetkiyi al' : 'Yönetici yap'}
                        onay={k.is_admin ? `${k.display_name} artık panele giremeyecek. Devam edilsin mi?` : `${k.display_name} yönetim paneline girebilecek ve içerik silebilecek. Devam edilsin mi?`}
                        tehlikeli={!k.is_admin}
                      />
                    </form>
                    {!k.is_admin ? (
                      <form action={engelDegistir} className={styles.islemler}>
                        <input type="hidden" name="id" value={k.id} />
                        <input type="hidden" name="engelli" value={k.engelli ? 'false' : 'true'} />
                        <OnayliDugme
                          etiket={k.engelli ? 'Engeli kaldır' : 'Engelle'}
                          onay={k.engelli ? `${k.display_name} yeniden giriş yapabilecek. Devam edilsin mi?` : `${k.display_name} artık giriş yapamayacak (açık oturumu en geç 1 saat içinde kapanır). Devam edilsin mi?`}
                          tehlikeli={!k.engelli}
                        />
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Sayfalama yol="/admin/kullanicilar" q={q} sayfa={sayfa} toplam={s.toplam} />
    </>
  );
}
