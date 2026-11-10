import type { Metadata } from 'next';

import { Eposta } from '../Iletisim';
import styles from '../yasal.module.css';

export const metadata: Metadata = {
  title: 'Hesap silme',
  description: 'Lykiva hesabını ve verilerini nasıl silersin, neler silinir.',
};

export default function HesapSilme() {
  return (
    <article>
      <h1>Lykiva hesabını silme</h1>
      <p className={styles.tarih}>Son güncelleme: 10 Kasım 2026</p>

      <h2>Uygulamadan</h2>
      <ol>
        <li>Lykiva uygulamasını aç.</li>
        <li>
          <strong>Profil</strong> sekmesinde sağ üstteki <strong>…</strong> düğmesine dokunarak <strong>Ayarlar</strong>&apos;ı aç.
        </li>
        <li>
          En alttaki <strong>Hesabımı sil</strong> düğmesine dokun ve onayla.
        </li>
      </ol>
      <p>Hesabın ve verilerin hemen silinir; bu işlem geri alınamaz.</p>

      <h2>Uygulamaya erişemiyorsan</h2>
      <p>
        Uygulamayı silmiş ya da telefonunu değiştirmişsen, Lykiva&apos;da kullandığın e-posta adresinden <Eposta /> adresine &quot;Hesap silme
        talebi&quot; konulu bir e-posta gönder. Hesabın sana ait olduğunu doğruladıktan sonra en geç 30 gün içinde sileriz.
      </p>

      <h2>Neler silinir</h2>
      <ul>
        <li>Hesabın ve profilin (ad, kullanıcı adı, şehir, hakkında, profil fotoğrafı)</li>
        <li>Tüm aktivitelerin, konum kayıtların, molaların ve mola fotoğrafların</li>
        <li>Rotaların, yorumların, beğenilerin, takiplerin, grup mesajların ve etkinlik katılımların</li>
        <li>Bildirimlerin ve telefon bildirim jetonların, paylaşım bağlantıların</li>
      </ul>
      <div className={styles.kutu}>
        <p>
          <strong>Kurduğun gruplar</strong> silinmez; diğer üyeler için devam etmesi amacıyla en kıdemli yöneticiye, yoksa en eski üyeye devredilir.
          Başka üyesi olmayan grup silinir. <strong>Oluşturduğun etkinlikler</strong> silinir.
        </p>
      </div>

      <h2>Yedekler</h2>
      <p>
        Silinen veriler, olası bir arızaya karşı alınan güvenlik yedeklerinde en fazla 60 gün daha kalabilir. Yedeklere yalnızca arıza durumunda
        geri dönmek için erişilir; süre dolunca yedeklerle birlikte silinir.
      </p>
    </article>
  );
}
