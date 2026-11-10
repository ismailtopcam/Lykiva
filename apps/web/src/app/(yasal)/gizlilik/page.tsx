import type { Metadata } from 'next';
import Link from 'next/link';

import { Eposta, Sorumlu } from '../Iletisim';
import styles from '../yasal.module.css';

export const metadata: Metadata = {
  title: 'Gizlilik politikası',
  description: 'Lykiva hangi verileri topluyor, neden kullanıyor, kimlerle paylaşıyor ve haklarınız.',
};

export default function Gizlilik() {
  return (
    <article>
      <h1>Gizlilik politikası</h1>
      <p className={styles.tarih}>Son güncelleme: 10 Kasım 2026</p>

      <p>
        Bu metin, Lykiva mobil uygulamasını ve lykiva.ismailtopcam.dev web sitesini kullanırken kişisel verilerinin nasıl işlendiğini
        6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında açıklar.
      </p>

      <h2>Veri sorumlusu</h2>
      <p>
        <Sorumlu />. İletişim: <Eposta />
      </p>

      <h2>Topladığımız veriler</h2>
      <ul>
        <li>
          <strong>Hesap bilgileri:</strong> Google ya da Apple ile giriş yaparsan e-posta adresin, adın ve (varsa) profil fotoğrafının adresi.
          Giriş yapmadan kullanırsan yalnızca bu telefona bağlı geçici bir hesap açılır.
        </li>
        <li>
          <strong>Profil:</strong> ad, kullanıcı adı ve isteğe bağlı olarak şehir, &quot;hakkında&quot; yazısı ve profil fotoğrafı.
        </li>
        <li>
          <strong>Konum ve aktivite kayıtları:</strong> kayıt başlattığında GPS konumu, zaman, yükseklik ve hız; kayıt sürerken uygulama arka
          plandayken ya da ekran kapalıyken de alınır. Kayıt dışında konumun alınmaz. Kayıttan hesaplanan mesafe, süre, tırmanış, molalar ve
          kayıt başındaki hava durumu da aktiviteyle saklanır.
        </li>
        <li>
          <strong>Canlı konum:</strong> yalnızca sen açtığında, seçtiğin gruplarla paylaşılır; sunucuda yalnızca son konumun tutulur.
        </li>
        <li>
          <strong>Paylaştığın içerik:</strong> rotalar, mola fotoğrafları, yorumlar, beğeniler, takip ettiğin kişiler, grup üyelikleri ve mesajları,
          etkinlik katılımları, gönderdiğin şikayetler.
        </li>
        <li>
          <strong>Bildirim jetonu:</strong> telefon bildirimlerini açarsan cihazına bildirim gönderebilmek için verilen kimlik.
        </li>
      </ul>
      <p>Fotoğrafları yüklemeden önce küçültürüz; fotoğraftaki konum bilgisi (EXIF) yüklenen dosyaya geçmez.</p>

      <h2>Verileri neden kullanıyoruz</h2>
      <ul>
        <li>Aktivitelerini kaydetmek, istatistiklerini ve haritasını göstermek (sözleşmenin ifası).</li>
        <li>Seçtiğin kişilerle paylaşmak: akış, gruplar, etkinlikler, paylaşım bağlantıları (sözleşmenin ifası, açık rızan).</li>
        <li>Bildirim göndermek (açık rızan; istediğin an kapatabilirsin).</li>
        <li>Kötüye kullanımı önlemek, şikayetleri incelemek ve hizmetin güvenliğini sağlamak (meşru menfaat).</li>
      </ul>
      <p>Verilerini reklam için kullanmıyor, satmıyoruz.</p>

      <h2>Kim görebilir</h2>
      <p>
        Her aktivite ve rota için kimin görebileceğini sen seçersin: yalnızca sen, takipçilerin, grupların ya da herkes. Başlangıç ve bitiş
        noktalarını gizleyebilirsin; o zaman izin baş ve son kısmı başkalarına gösterilmez. Paylaşım bağlantısı açtığın aktiviteyi bağlantıyı
        bilen herkes görür; bağlantıyı istediğin an kapatabilirsin. Web profilinde (lykiva.ismailtopcam.dev/u/kullanıcı-adın) yalnızca adın,
        sayıların ve herkese açık aktivitelerinin özeti görünür. Bu sayfalar arama motorlarına kapalıdır.
      </p>

      <h2>Hizmet aldığımız taraflar</h2>
      <p>Uygulamanın çalışması için bazı veriler şu hizmetlere gönderilir:</p>
      <ul>
        <li>
          <strong>Lykiva sunucusu</strong> (Supabase, kendi sunucumuzda): hesap, profil, aktivite, fotoğraf ve diğer tüm içerik burada saklanır.
        </li>
        <li>
          <strong>MET Norway</strong> (Norveç Meteoroloji Enstitüsü): kayıt başlarken hava durumu için yaklaşık 100 metreye yuvarlanmış konum.
        </li>
        <li>
          <strong>BRouter ve Photon</strong> (brouter.de, photon.komoot.io): rota çizerken seçtiğin noktalar ve yer ararken yazdığın metin.
        </li>
        <li>
          <strong>OpenFreeMap</strong>: harita görüntülerini indirmek için görüntülenen bölge (her harita uygulamasında olduğu gibi).
        </li>
        <li>
          <strong>Expo, Apple ve Google</strong>: telefon bildirimlerinin iletilmesi; Google ya da Apple ile girişte kimlik doğrulama.
        </li>
      </ul>
      <p>
        Bu hizmetlerin bir kısmı yurt dışındadır; bu aktarım yalnızca yukarıdaki işlevler için ve gereken en az veriyle yapılır.
      </p>

      <h2>Ne kadar saklıyoruz</h2>
      <p>
        Verilerin hesabın açık olduğu sürece saklanır. Hesabını sildiğinde verilerin hemen silinir; yalnızca güvenlik yedeklerinde en fazla 60
        gün daha kalır ve bu sürenin sonunda yedeklerle birlikte silinir. Ayrıntı: <Link href="/hesap-silme">Hesap silme</Link>.
      </p>

      <h2>Hakların</h2>
      <p>KVKK&apos;nın 11. maddesi uyarınca:</p>
      <ul>
        <li>verilerinin işlenip işlenmediğini öğrenme ve bilgi isteme,</li>
        <li>yanlış ya da eksik verilerin düzeltilmesini, silinmesini isteme,</li>
        <li>verilerin aktarıldığı tarafları öğrenme,</li>
        <li>işlemeye itiraz etme ve zarara uğradıysan giderilmesini isteme</li>
      </ul>
      <p>
        haklarına sahipsin. Profilini ve içeriğini uygulamadan düzenleyebilir, hesabını uygulamanın Ayarlar ekranından silebilirsin. Diğer
        talepler için <Eposta /> adresine yaz; en geç 30 gün içinde yanıt veririz.
      </p>

      <h2>Değişiklikler</h2>
      <p>Bu metni güncellediğimizde yukarıdaki tarih değişir.</p>
    </article>
  );
}
