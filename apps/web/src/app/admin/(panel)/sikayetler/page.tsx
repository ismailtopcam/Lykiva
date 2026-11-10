import Link from 'next/link';
import { Suspense } from 'react';

import { liste, yonetimRpc, type Sayfa, type SikayetSatiri } from '@/lib/yonetim/veri';
import { aktiviteSil, engelDegistir, etkinlikSil, grupSil, mesajSil, rotaGizle, sikayetGuncelle, yorumSil } from '../actions';
import styles from '../admin.module.css';
import { OnayliDugme } from '../OnayliDugme';
import { Baslik, Bos, Etiket, Sayfalama, tarih, Yukleniyor } from '../ui';

const TUR: Record<SikayetSatiri['target_type'], string> = {
  user: 'Kullanıcı',
  activity: 'Aktivite',
  route: 'Rota',
  message: 'Grup mesajı',
  comment: 'Yorum',
  group: 'Grup',
  event: 'Etkinlik',
};

const DURUM: Record<SikayetSatiri['status'], [string, 'toprak' | 'deniz' | 'gri' | 'koyu']> = {
  open: ['Açık', 'toprak'],
  reviewing: ['İnceleniyor', 'deniz'],
  resolved: ['Çözüldü', 'koyu'],
  dismissed: ['Yersiz', 'gri'],
};

const SEKMELER = [
  { k: 'acik', ad: 'Açık' },
  { k: 'kapali', ad: 'Kapalı' },
  { k: 'hepsi', ad: 'Hepsi' },
];

export default function Sikayetler({ searchParams }: PageProps<'/admin/sikayetler'>) {
  return (
    <>
      <Baslik alt="Uygulamadan gelen şikayetler. Durumu ve notu değiştirebilir, içeriği kaldırabilirsin.">Şikayetler</Baslik>
      <Suspense fallback={<Yukleniyor />}>
        <Icerik searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Icerik({ searchParams }: { searchParams: PageProps<'/admin/sikayetler'>['searchParams'] }) {
  const { sayfa, sp } = await liste(searchParams);
  const durum = typeof sp.durum === 'string' && ['acik', 'kapali', 'hepsi'].includes(sp.durum) ? sp.durum : 'acik';
  const s = await yonetimRpc<Sayfa<SikayetSatiri>>('yonetim_sikayetler', { durum, sayfa });
  return (
    <>
      <nav className={styles.sekmeler} aria-label="Şikayet durumu">
        {SEKMELER.map((t) => (
          <Link
            key={t.k}
            href={t.k === 'acik' ? '/admin/sikayetler' : `/admin/sikayetler?durum=${t.k}`}
            aria-current={t.k === durum ? 'page' : undefined}
            className={t.k === durum ? `${styles.sekme} ${styles.sekmeAktif}` : styles.sekme}>
            {t.ad}
          </Link>
        ))}
      </nav>
      {s.satirlar.length === 0 ? (
        <Bos>{durum === 'acik' ? 'Açık şikayet yok.' : 'Şikayet yok.'}</Bos>
      ) : (
        <div className={styles.sikayetler}>
          {s.satirlar.map((r) => (
            <article key={r.id} className={styles.sikayet}>
              <div className={styles.sikayetUst}>
                <Etiket ton={DURUM[r.status][1]}>{DURUM[r.status][0]}</Etiket>
                <span>{TUR[r.target_type]}</span>
                <span>·</span>
                <span>{tarih(r.created_at)}</span>
                <span>·</span>
                <span>bildiren: {r.bildiren}</span>
                {r.ayni_hedef > 1 ? <Etiket ton="toprak">Bu içerik için {r.ayni_hedef} şikayet</Etiket> : null}
              </div>
              <div>
                {r.hedef ? (
                  <>
                    <span className={styles.sikayetHedef}>{r.hedef.ad}</span>
                    <span className={styles.ikincil}>{r.hedef.alt}</span>
                  </>
                ) : (
                  <span className={styles.ikincil}>İçerik silinmiş</span>
                )}
              </div>
              <p>
                <strong>Neden:</strong> {r.reason}
              </p>
              <form action={sikayetGuncelle} className={styles.sikayetForm}>
                <input type="hidden" name="id" value={r.id} />
                <input name="notu" defaultValue={r.admin_note ?? ''} placeholder="Not (isteğe bağlı)" aria-label="Yönetici notu" className={styles.notKutu} />
                <select name="durum" defaultValue={r.status} aria-label="Durum" className={styles.btn}>
                  <option value="open">Açık</option>
                  <option value="reviewing">İnceleniyor</option>
                  <option value="resolved">Çözüldü</option>
                  <option value="dismissed">Yersiz</option>
                </select>
                <OnayliDugme etiket="Kaydet" />
              </form>
              {r.hedef ? <Kaldir r={r} /> : null}
            </article>
          ))}
        </div>
      )}
      <Sayfalama yol="/admin/sikayetler" q="" sayfa={sayfa} toplam={s.toplam} ekstra={durum === 'acik' ? undefined : { durum }} />
    </>
  );
}

/** Şikayet edilen içeriği kaldırma (türüne göre) */
function Kaldir({ r }: { r: SikayetSatiri }) {
  const islem =
    r.target_type === 'activity'
      ? { action: aktiviteSil, etiket: 'Aktiviteyi sil', onay: 'Aktivite kalıcı olarak silinsin mi? Geri alınamaz.' }
      : r.target_type === 'route'
        ? { action: rotaGizle, etiket: 'Rotayı herkese kapat', onay: 'Rota yalnızca sahibine görünür olacak. Devam edilsin mi?' }
        : r.target_type === 'group'
          ? { action: grupSil, etiket: 'Grubu sil', onay: 'Grup, üyelikleri ve mesajlarıyla kalıcı olarak silinsin mi? Geri alınamaz.' }
          : r.target_type === 'event'
            ? { action: etkinlikSil, etiket: 'Etkinliği sil', onay: 'Etkinlik kalıcı olarak silinsin mi? Geri alınamaz.' }
            : r.target_type === 'comment'
              ? { action: yorumSil, etiket: 'Yorumu kaldır', onay: 'Yorum kalıcı olarak silinsin mi? Geri alınamaz.' }
              : r.target_type === 'message'
                ? { action: mesajSil, etiket: 'Mesajı kaldır', onay: 'Mesaj gruptan kalıcı olarak silinsin mi? Geri alınamaz.' }
                : r.target_type === 'user'
                  ? { action: engelDegistir, etiket: 'Kullanıcıyı engelle', onay: 'Kullanıcı artık giriş yapamayacak (açık oturumu en geç 1 saat içinde kapanır). Engeli Kullanıcılar sayfasından kaldırabilirsin. Devam edilsin mi?' }
                  : null;
  if (!islem) return null;
  return (
    <form action={islem.action}>
      <input type="hidden" name="id" value={r.target_id} />
      {r.target_type === 'user' ? <input type="hidden" name="engelli" value="true" /> : null}
      <OnayliDugme etiket={islem.etiket} onay={islem.onay} tehlikeli />
    </form>
  );
}
