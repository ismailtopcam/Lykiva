# Mağaza kaydı — metinler ve beyanlar

Google Play Console'a (ve sonra App Store Connect'e) girilen metinlerin ve politika cevaplarının kaynağı.
Konsolda bir şey değiştirirsen burayı da güncelle.

- Play Console: geliştirici hesabı **İsmail Topçam (kişisel)**, uygulama **Lykiva**, paket `app.lykiva.mobile`,
  varsayılan dil Türkçe (tr-TR), ücretsiz.
- Kişisel hesap olduğu için üretime çıkmadan önce **en az 12 test kullanıcısıyla 14 gün kesintisiz kapalı test** gerekir.

## Mağaza girişi

**Uygulama adı (30):** Lykiva

**Kısa açıklama (80):**
Bisiklet, koşu ve doğa yürüyüşlerini kaydet; rotalarını arkadaşlarınla paylaş.

**Tam açıklama (4000):**

Lykiva; bisiklet, dağ bisikleti, koşu, patika koşusu, yürüyüş ve doğa yürüyüşü için bir aktivite takip ve
paylaşım uygulamasıdır.

KAYDET
• GPS ile rotanı, mesafeni, süreni, hızını ve yükseliş bilgisini kaydet.
• Ekran kapalıyken de kayıt sürer; molalarını ve mola fotoğraflarını ekle.
• Kayıt başında hava durumu otomatik olarak eklenir.

PLANLA
• Haritada rota çiz, mesafe ve yükseliş profilini önceden gör.
• Kaydettiğin rotayı takip et; rotadan ne kadar uzaklaştığını gör.

BİRLİKTE ÇIK
• Arkadaşlarını takip et, aktivitelerini akışta gör.
• Gruplara katıl, grup etkinlikleri oluştur.
• Kayıt sırasında son konumunu yalnızca seçtiğin grupla paylaş; kayıt bitince paylaşım kapanır.

GİZLİLİK SENDE
• Her aktivite ve rota için kimin görebileceğini sen seçersin: yalnız sen, takipçilerin, grupların ya da herkes.
• Rotanın başı ve sonu (ev, iş) varsayılan olarak gizlidir.
• Hesabını ve verilerini uygulama içinden istediğin zaman silebilirsin.

Hava durumu verisi: MET Norway.

## Grafikler

| Öğe | Ölçü | Durum |
| --- | --- | --- |
| Uygulama simgesi | 512×512 PNG | `assets/icon.png`'den üretilecek |
| Öne çıkan grafik | 1024×500 PNG/JPG | hazırlanacak |
| Telefon ekran görüntüsü | en az 2, 16:9 ya da 9:16, kenar 320–3840 px | telefondaki derlemeden alınacak |

## Uygulama içeriği (Politika > Uygulama içeriği)

| Bölüm | Cevap |
| --- | --- |
| Gizlilik politikası | https://lykiva.app/gizlilik |
| Uygulama erişimi | Tüm işlevler özel erişim gerekmeden kullanılabilir: giriş ekranında "Şimdilik geç" ile geçici hesap açılır. |
| Reklamlar | Reklam yok |
| İçerik derecelendirmesi | Kategori: "Diğer tüm uygulama türleri". Şiddet / cinsellik / kumar yok. Kullanıcılar etkileşim kurar ve içerik paylaşır (evet), kullanıcı konumu diğer kullanıcılarla paylaşılır (evet), dijital satın alma yok. |
| Hedef kitle | 18 yaş ve üzeri (çocuklara yönelik değil) |
| Haber uygulaması | Hayır |
| Devlet uygulaması | Hayır |
| Finansal özellikler | Yok |
| Sağlık uygulamaları | Fitness / aktivite takibi |
| Hesap silme | https://lykiva.app/hesap-silme (uygulama içinden de: Ayarlar) |

### Veri güvenliği

Aktarım sırasında şifreleniyor: **evet** (HTTPS). Kullanıcı silme isteyebiliyor: **evet**.

| Veri türü | Toplanıyor | Paylaşılıyor | Amaç | Zorunlu mu |
| --- | --- | --- | --- | --- |
| Hassas konum | Evet | Hayır | Uygulama işlevi | Kayıt için evet |
| Yaklaşık konum | Evet | Evet: hava durumu servisi (MET Norway, koordinat 3 ondalık) | Uygulama işlevi | Kayıt için evet |
| Ad (görünen ad) | Evet | Hayır | Hesap yönetimi, uygulama işlevi | İsteğe bağlı |
| E-posta adresi | Evet (Google / Apple girişinde) | Hayır | Hesap yönetimi | İsteğe bağlı |
| Kullanıcı kimlikleri | Evet | Hayır | Hesap yönetimi, uygulama işlevi | Evet |
| Fotoğraflar | Evet | Hayır | Uygulama işlevi | İsteğe bağlı |
| Fitness bilgileri (mesafe, hız, süre) | Evet | Hayır | Uygulama işlevi | Evet |
| Uygulama içi diğer kullanıcı içeriği (yorum, açıklama) | Evet | Hayır | Uygulama işlevi | İsteğe bağlı |
| Cihaz kimliği (bildirim jetonu) | Evet | Hayır | Uygulama işlevi (bildirim) | İsteğe bağlı |

Kayıt sırasında seçilen grupla canlı konum paylaşımı kullanıcının kendi başlattığı bir aktarım olduğu için
Play'in tanımında "paylaşım" sayılmaz. Rota çizimi ve yer arama şu an herkese açık brouter.de / photon.komoot.io'ya
gidiyor; kendi sunucularımız kurulunca bu satır gereksizleşir (kurulana kadar rota noktaları ve arama metni bu
servislere gider).

### Hassas izinler

- **Arka planda konum (`ACCESS_BACKGROUND_LOCATION`)**: Kayıt başlatıldığında, ekran kapalıyken ve uygulama
  arka plandayken rotayı kaydetmeye devam etmek için. İzin istenmeden önce uygulama içinde açık bir bilgilendirme
  gösteriliyor (`src/kayit/kaydedici.ts`). Beyan formunda **YouTube videosu** istenir: bilgilendirme penceresi →
  izin ekranı → ekran kapalıyken süren kayıt.
- **Ön plan servisi — konum (`FOREGROUND_SERVICE_LOCATION`)**: Kullanıcının başlattığı GPS kaydı; bildirimde
  "Lykiva kaydediyor" görünür.
- Engellenen izinler (`app.json` > `android.blockedPermissions`): `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`.
