import type { Metadata } from 'next';
import Link from 'next/link';

import { Eposta } from '../Iletisim';
import styles from '../yasal.module.css';

export const metadata: Metadata = {
  title: 'Kullanım koşulları',
  description: 'Lykiva uygulamasını ve web sitesini kullanma koşulları.',
};

export default function Kosullar() {
  return (
    <article>
      <h1>Kullanım koşulları</h1>
      <p className={styles.tarih}>Son güncelleme: 10 Kasım 2026</p>

      <p>
        Lykiva&apos;yı (mobil uygulama ve lykiva.ismailtopcam.dev) kullanarak bu koşulları kabul etmiş olursun. Kişisel verilerin nasıl
        işlendiği <Link href="/gizlilik">Gizlilik politikası</Link>&apos;nda anlatılır.
      </p>

      <h2>Hizmet</h2>
      <p>
        Lykiva; bisiklet, koşu, yürüyüş ve doğa sporları için aktivite kaydetmeni, rota çizmeni, aktivitelerini ve rotalarını paylaşmanı,
        grup ve etkinlik oluşturmanı sağlar. Hizmet ücretsizdir ve zaman içinde değişebilir.
      </p>

      <h2>Hesabın</h2>
      <ul>
        <li>Hesabının güvenliğinden ve hesabınla yapılan işlemlerden sen sorumlusun.</li>
        <li>Giriş yapmadan kullanırsan kayıtların yalnızca o telefondaki geçici hesaba bağlıdır; telefonu kaybedersen ya da uygulamayı silersen kaybolabilir.</li>
        <li>
          Hesabını istediğin zaman uygulamanın Ayarlar ekranından silebilirsin (<Link href="/hesap-silme">ayrıntı</Link>).
        </li>
      </ul>

      <h2>Paylaştığın içerik</h2>
      <p>
        Yüklediğin aktiviteler, rotalar, fotoğraflar, yorumlar ve mesajlar sana aittir. Bunları seçtiğin kişilere göstermek ve hizmeti çalıştırmak
        için (saklama, küçültme, harita ve kart görseli oluşturma gibi) kullanmamıza izin vermiş olursun. İçeriği sildiğinde ya da hesabını
        kapattığında bu izin sona erer.
      </p>

      <h2>Kurallar</h2>
      <p>Lykiva&apos;yı kullanırken şunları yapmamalısın:</p>
      <ul>
        <li>yasalara aykırı, nefret söylemi içeren, taciz edici ya da müstehcen içerik paylaşmak,</li>
        <li>başkalarının fotoğraflarını ya da kişisel bilgilerini izinsiz paylaşmak, başkası gibi davranmak,</li>
        <li>istenmeyen toplu mesaj (spam) göndermek, sahte hesap açmak,</li>
        <li>hizmetin işleyişini bozmaya, başkalarının hesaplarına ya da verilerine erişmeye çalışmak.</li>
      </ul>
      <p>
        Uygunsuz içeriği uygulamadaki &quot;Şikayet et&quot; bağlantısıyla bildirebilirsin. Kurallara aykırı içeriği kaldırabilir, gerektiğinde
        hesabı askıya alabilir ya da kapatabiliriz.
      </p>

      <h2>Güvenlik ve sorumluluk</h2>
      <p>
        Rotalar, mesafe, yükseklik, süre tahminleri ve hava durumu bilgi amaçlıdır; doğruluğu garanti edilmez. Yola çıkmadan önce hava ve arazi
        koşullarını, kendi sağlık durumunu ve yerel kuralları kendin değerlendirmelisin. Doğa sporları risk içerir; bu risk sana aittir. Harita
        ve rota verileri OpenStreetMap katkıcılarına aittir.
      </p>
      <p>
        Hizmet &quot;olduğu gibi&quot; sunulur. Kesintisiz ya da hatasız çalışacağını garanti etmiyoruz; yasaların izin verdiği ölçüde,
        hizmetin kullanımından doğan dolaylı zararlardan sorumlu değiliz.
      </p>

      <h2>Değişiklikler</h2>
      <p>Bu koşulları güncelleyebiliriz; güncellendiğinde yukarıdaki tarih değişir. Kullanmaya devam etmen güncel koşulları kabul ettiğin anlamına gelir.</p>

      <h2>İletişim</h2>
      <p>
        Sorular için: <Eposta />
      </p>
    </article>
  );
}
