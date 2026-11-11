# Supabase

Kendi sunucumuzda (Coolify, `lykiva-supabase` servisi): https://api.lykiva.app

`migrations/` altındaki SQL dosyaları sırayla uygulanır. "Sunucuda" sütunu elle tutulur ve geride kalabilir;
gerçek durum için aşağıdaki `uygula.sh` (durum modu) ya da `node scripts/sunucu-kontrol.mjs` kullanılır.

| Dosya | İçerik | Sunucuda |
| --- | --- | --- |
| `20261107000000_ilk_sema.sql` | Tablolar, PostGIS, RLS açık | uygulandı |
| `20261108000000_kayit_ve_kurallar.sql` | Profil tetikleyicisi, aktivite/rota/takip kuralları, `kaydet_aktivite`, `aktivite_detay`, `aktivite_ozetleri` | uygulandı (8 Kasım 2026) |
| `20261109000000_giris.sql` | Hesap devri: `devir_kodu_al`, `hesabi_devral` (geçici hesaptaki kayıtları asıl hesaba taşır) | uygulandı (11 Kasım 2026 `uygula.sh` ile doğrulandı) |
| `20261109010000_rotalar.sql` | `kaydet_rota`, `aktiviteden_rota`, `rota_ozetleri`; aktiviteye `route_id` | uygulandı (8 Kasım 2026) |
| `20261109020000_paylasim.sql` | `aktivite_noktalari` (GPX dışa aktarımı; yalnızca sahibi nokta alır) | uygulandı (8 Kasım 2026, elle) |
| `20261109030000_gruplar.sql` | Grup / üyelik / sohbet kuralları, davet kodu, katılma istekleri, okundu bilgisi, gruba rota paylaşma, "gruplar" görünürlüğü; `messages` Realtime yayınında | uygulandı (11 Kasım 2026 `uygula.sh` ile doğrulandı) |
| `20261109040000_etkinlikler.sql` | Etkinlik ve katılım kuralları, `etkinlik_olustur`, `etkinlik_detay`, `katilim_bildir` (kontenjan + bekleme listesi), `grup_etkinlikleri`, `yaklasan_etkinlikler`, `etkinlik_sil` | uygulandı (11 Kasım 2026 `uygula.sh` ile doğrulandı) |
| `20261109050000_canli_konum.sql` | Canlı konum kuralları (yalnızca grup üyeleri, 15 dk tazelik), `canli_konum_gonder`, `canli_konum_bitir`, `grup_canli_konumlari`, `grup_canli_sayisi`; gruptan ayrılınca paylaşım silinir | uygulandı (11 Kasım 2026 `uygula.sh` ile doğrulandı) |
| `20261110000000_akis_takip.sql` | Akış (`akis`: takip ettiklerim / gruplarım / yakınımda, sayfalı), `kisi_profili`, `kisi_ara` (geçici hesaplar görünmez), `takip_listesi`; hesap devrinde takipler, grup üyelikleri, etkinlik katılımları ve mesajlar da taşınır | uygulandı (10 Kasım 2026) |
| `20261110010000_yorumlar.sql` | Yorumlar: `yorum_yaz` (1–1000 karakter, dakikada en fazla 10), `yorum_sil` (yazan ya da aktivitenin sahibi), `aktivite_yorumlari`, `aktivite_sosyal` (beğeni / yorum sayısı); tabloya doğrudan yorum yazma kapalı | uygulandı (10 Kasım 2026) |
| `20261110020000_paylasim_baglantisi.sql` | Web paylaşım bağlantısı: `paylasim_baglantisi_ac` / `paylasim_baglantisi` / `paylasim_baglantisi_kapat` (yalnızca sahibi), `paylasilan_aktivite(anahtar)` (anon okur; iz kırpılmış, kimlik yok); anahtarlar istemciye kapalı `aktivite_baglantilari` tablosunda | uygulandı (10 Kasım 2026) |
| `20261110030000_bildirimler.sql` | Uygulama içi bildirimler: `bildirimler` tablosu (tetikleyicilerle yazılır: takip, beğeni, yorum, katılma isteği / kabulü, grupta etkinlik), `bildirimlerim`, `bildirim_sayisi`, `bildirimleri_okundu_say`; `istegi_yanitla` ve `hesabi_devral` güncellendi; tablo Realtime yayınında | uygulandı (10 Kasım 2026) |
| `20261110040000_birlikte.sql` | Birlikte yapılan aktivite: `birlikte_ekle` (yalnızca tanıdıklar), `birlikte_cikar`, `birlikte_kisiler`, `birlikte_onerileri` (aynı saatte aynı yoldan geçen, görebildiğin aktiviteler), "birlikte" bildirimi; `akis` kartında kişiler, etiketlendiğin aktiviteler akışında; `hesabi_devral` güncellendi | uygulandı (10 Kasım 2026) |
| `20261110050000_kesfet.sql` | Keşfet: `kesfet_rotalar` (herkese açık rotalar, konuma göre yakından uzağa, önizleme izi), `kesfet_etkinlikler` (30 gün, herkese açık + grup etkinlikleri, buluşma noktası yakınlığı) | uygulandı (10 Kasım 2026) |
| `20261110060000_yonetim.sql` | Yönetim paneli: `yonetici_mi`, `yonetim_ozet`, `yonetim_kullanicilar` / `aktiviteler` / `rotalar` / `gruplar` / `etkinlikler` / `sikayetler` (her biri yöneticiliği denetler), moderasyon (`yonetim_sikayet_guncelle`, `yonetim_aktivite_sil`, `yonetim_rota_gizle`, `yonetim_grup_sil`, `yonetim_etkinlik_sil`, `yonetim_yetki`), uygulamadan `sikayet_et`; `reports` istemciye kapalı | uygulandı (10 Kasım 2026) |
| `20261110070000_hava.sql` | `activities.weather` (kayıt başındaki hava; biçim denetimi, konum içeremez), `aktivite_ozetleri` ve `akis` kartında | uygulandı (10 Kasım 2026) |
| `20261110080000_push.sql` | Telefona bildirim: `push_jetonlari` (istemciye kapalı), `push_jetonu_kaydet` / `push_jetonu_sil`, `push_icerigi` (Türkçe metin), bildirim yazılınca pg_net ile Expo Push Service'e gönderim (pg_net yoksa atlanır) | uygulandı (10 Kasım 2026) |
| `20261110090000_profil.sql` | **Güvenlik:** `profiles` üzerinde istemci yalnızca `display_name` ve `avatar_url` yazabilir (önceden `is_admin` dahil her sütun yazılabiliyordu). `profil_guncelle` (ad, kullanıcı adı, şehir, hakkında; ayrılmış adlar ve `k_` ile başlayanlar reddedilir), `kullanici_adi_musait`, web için `herkese_acik_profil` (anon; yalnızca herkese açık aktivite özetleri), başlık/ad uzunluk sınırları | uygulandı (10 Kasım 2026) |
| `20261110100000_fotograflar.sql` | Depolama kovaları `profil` (herkese açık, `<kullanıcı id>/<uuid>.jpg`, yalnızca kendi klasörüne yazar) ve `mola` (gizli, `<aktivite id>/<uuid>.jpg`; aktiviteyi görebilen okur, sahibi yükler / siler), `storage.objects` kuralları, mola fotoğrafı sınırı (6, yalnızca o aktivitenin klasörü), profil fotoğrafı adresi yalnızca https, `aktivite_detay` molanın kimliğini ve fotoğraflarını döner. Depolama servisi (storage şeması) çalışıyor olmalı | uygulandı (10 Kasım 2026) |
| `20261110110000_yonetim_moderasyon.sql` | Panelden `yonetim_yorum_sil`, `yonetim_mesaj_sil`, `yonetim_engelle` (auth.users.banned_until, 100 yıl; kendini ve yöneticiyi engelleyemez; jetonları siler); `yonetim_kullanicilar` satırında `engelli` | uygulandı (10 Kasım 2026) |
| `20261110120000_hava_paylasim_push_temizligi.sql` | `paylasilan_aktivite` havayı da döner; `push_istekleri` (istemciye kapalı) + `push_yanitlarini_isle`: pg_net yanıtlarından "DeviceNotRegistered" dönen jetonları siler (bir sonraki bildirimde); `push_gonder` istek kimliğini ve jetonları kaydeder | uygulandı (10 Kasım 2026) |
| `20261111000000_hesap_silme_ayarlar.sql` | `hesabimi_sil` (uygulama içinden hesap silme; kurduğu gruplar devredilir, etkinlikleri silinir, gerisi zincirleme), `site_ayarlari` (yasal sayfalardaki iletişim e-postası ve veri sorumlusu; herkes okur, yönetici `yonetim_site_ayarlari_guncelle` ile değiştirir) | uygulandı (11 Kasım 2026) |
| `20261112000000_dil.sql` | Dil desteği: `profiles.dil` (tr, en, de, ru, ar; varsayılan tr), `dil_ayarla` (uygulama dili değişince ve açılışta kaydeder), `push_icerigi` telefon bildirimini alıcının dilinde yazar (Arapça metinleri gelene kadar İngilizce) | uygulandı (11 Kasım 2026) |
| `20261113000000_hedefler_meydan_okumalar.sql` | Hedefler: `hedefler` (yalnızca sahibi okur; `hedef_kaydet` / `hedef_sil`, kişi başı 12, dönem hafta / ay / yıl, ölçü mesafe / süre / sayı / tırmanış). Meydan okumalar: `meydan_okumalar` + `meydan_okuma_katilimcilari` (istemciye kapalı), `meydan_okumalar_listesi`, `meydan_okuma_detay` (sıralama: ilk 50 + benim yerim, yalnızca toplam), `meydan_okuma_olustur` (herkese açığı yönetici, grubunkini grup üyesi), `meydan_okumaya_katil` / `meydan_okumadan_ayril` / `meydan_okuma_sil`, `yonetim_meydan_okumalar`; gruptan ayrılınca grup meydan okumasından çıkılır; `hesabi_devral` güncellendi | **henüz uygulanmadı** |
| `20261114000000_isi_haritalari.sql` | Isı haritaları: `isi_haritasi(tur, bati, guney, dogu, kuzey, zoom)` görünen alandaki izleri ızgara hücrelerine toplar (`kuresel` / `haftalik` / `gece` yalnızca herkese açık, uçlar kırpılır, 8. yakınlaştırmadan önce boş; `kisisel` kendi bütün aktiviteleri); `profiles.isi_haritasinda` + `isi_haritasi_ayarla` (küresel haritalardan çıkma); `gunes_yuksekligi`, `gece_aktivitesi_mi` | **henüz uygulanmadı** |

Tüm tabloların kuralları yazıldı (son: canlı konum, `20261109050000_canli_konum.sql`). Gruplar ve mesajlar `20261109030000_gruplar.sql` ile açılır.

Takip etme / bırakma ve beğeni doğrudan tablo yazımıyla yapılır (`follows`, `activity_likes`; kurallar `20261108000000`'de).
Yorum ise yalnızca `yorum_yaz` / `yorum_sil` ile yazılır ve silinir (uzunluk ve hız sınırı atlanamasın diye).

**Gizlilik:** Ham GPS noktalarını yalnızca sahibi okur. Başkalarına gösterilen iz, `hide_endpoints`
açıksa baştan ve sondan 200 m kırpılır (ev / iş adresi görünmesin diye).

## Migration'ları uygulamak

İsmail'in bilgisayarından (Tailscale + SSH anahtarı) doğrudan:

```bash
ssh root@uygulama 'curl -fsSL https://raw.githubusercontent.com/ismailtopcam/Lykiva/main/supabase/uygula.sh | bash'
```

Sona `-s -- uygula` eklenince eksikleri uygular. Bu erişim yoksa Coolify > Terminal > `uygulama` sunucusunda
aşağıdaki komutlar çalıştırılır. Önce durumu gör (hiçbir şey değiştirmez):

```bash
curl -fsSL https://raw.githubusercontent.com/ismailtopcam/Lykiva/main/supabase/uygula.sh | bash
```

Eksikleri uygula (her biri tek işlemde; hata olursa o migration geri alınır ve betik durur):

```bash
curl -fsSL https://raw.githubusercontent.com/ismailtopcam/Lykiva/main/supabase/uygula.sh | bash -s -- uygula
```

Betik sonunda Realtime konteynerini ve `supabase_realtime` yayınındaki tabloları da gösterir.
Yeni bir migration eklenince `uygula.sh` içindeki listeye (dosya + o migration'ın oluşturduğu bir fonksiyon) eklenmeli.

Tek bir dosyayı elle uygulamak için:

```bash
curl -fsSL https://raw.githubusercontent.com/ismailtopcam/Lykiva/main/supabase/migrations/<dosya>.sql \
  | docker exec -i supabase-db-nqyujqqkkjyba4flthzcf9uf psql -U postgres -v ON_ERROR_STOP=1 -1
```

## Migration'ları sunucuya göndermeden denemek

```bash
npm run test:sql
```

Bellekte PGlite + PostGIS ile boş bir veritabanı açar, Supabase'in `auth` şemasını ve rollerini taklit eder,
tüm migration'ları sırayla uygular ve farklı kullanıcılar adına senaryoları dener (`supabase/test/dene.mjs`):
akış süzgeçleri, görünürlük kuralları, baş/son 200 m kırpma, beğeni, sayfalama, kişi arama, hesap devri, yorumlar, paylaşım bağlantısı, bildirimler, birlikte yapılan aktivite, Keşfet, yönetim paneli ve şikayetler, hava, telefona bildirim, yetkiler.
Gerçek Supabase'in birebir aynısı değildir (GoTrue, Realtime yok). Yeni migration eklenince senaryoları da eklenmeli.

## Sunucuyu Mac'ten kontrol etmek

`apps/mobile/.env` içindeki anahtarla, yalnızca okuyarak: giriş ayarları (geçici hesap, Google, Apple),
her migration'ın sunucuda olup olmadığı ve Realtime bağlantısı.

```bash
node scripts/sunucu-kontrol.mjs
```

## Giriş

Geçici (anonim) giriş açık (`ENABLE_ANONYMOUS_USERS=true`). Uygulama Google, Apple ve e-posta + şifre girişini kullanır:

- **Apple** (yalnızca iOS): telefonun kendi penceresi, kimlik jetonu `signInWithIdToken` / `linkIdentity` ile verilir.
  Apple tarafında gizli anahtar (secret) gerekmez; sadece bundle id.
- **Google**: Supabase'in `/auth/v1/authorize` sayfası uygulama içi tarayıcıda açılır, dönüş `lykiva://giris-donus`.
- Geçici hesaptaysa yeni hesap açılmaz, kimlik bu hesaba bağlanır (manual linking açık olmalı).
  Kimlik başka bir hesaptaysa asıl hesaba girilir ve `hesabi_devral` ile kayıtlar taşınır.
- **E-posta + şifre** (`apps/mobile/src/lib/epostaGiris.ts`): doğrulama ve şifre sıfırlama **e-postadaki kodla**
  (bağlantı yok; kullanıcı kodu uygulamaya yazar). Geçici hesaptan kayıt olunursa e-posta o hesaba eklenir
  (`updateUser({ email })` → `email_change` kodu → şifre konur); var olan hesaba giriş / şifre sıfırlamada kayıtlar
  `hesabi_devral` ile taşınır. Ayar ve şablonlar: aşağıda **E-posta**.

### Sunucu ayarı (Coolify > lykiva-supabase) — 9 Kasım 2026 itibarıyla yapıldı

`supabase-auth` servisinin compose'una şu satırlar eklendi (Coolify API ile) ve servis yeniden başlatıldı:

```yaml
      - 'GOTRUE_SECURITY_MANUAL_LINKING_ENABLED=${ENABLE_MANUAL_LINKING:-true}'
      - 'GOTRUE_EXTERNAL_APPLE_ENABLED=${ENABLE_APPLE_SIGNIN:-true}'
      - 'GOTRUE_EXTERNAL_APPLE_CLIENT_ID=${APPLE_CLIENT_ID:-app.lykiva.mobile}'
      - 'GOTRUE_EXTERNAL_GOOGLE_ENABLED=${ENABLE_GOOGLE_SIGNIN:-false}'
      - 'GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}'
      - 'GOTRUE_EXTERNAL_GOOGLE_SECRET=${GOOGLE_SECRET}'
      - 'GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=${SERVICE_URL_SUPABASEKONG}/auth/v1/callback'
```

- Hesap bağlama ve Apple girişi **açık**; Apple için gizli anahtar gerekmez (yerel giriş yalnızca bundle id'ye bakar).
- `ADDITIONAL_REDIRECT_URLS` zaten `lykiva://**` içeriyor (`lykiva://giris-donus` kapsanıyor).
- **Google açık** (11 Kasım 2026): Coolify > lykiva-supabase > Environment Variables'ta `GOOGLE_CLIENT_ID`, `GOOGLE_SECRET` dolu, `ENABLE_GOOGLE_SIGNIN=true`. İstemci Google Cloud projesi `lykiva`'da ("Lykiva sunucu (Supabase)"); sırrı değiştirirsen servisi yeniden başlat.
- Bundle id değişirse `APPLE_CLIENT_ID` değişkeni güncellenmeli.

- Google Cloud Console: OAuth istemcisi türü **Web application**, yetkili yönlendirme adresi
  `https://api.lykiva.app/auth/v1/callback`.
- Apple Developer: `app.lykiva.mobile` App ID'sinde **Sign in with Apple** açık olmalı (ücretli hesapla Xcode'un otomatik imzalaması bunu kendisi açar).
  Bundle id değişirse `GOTRUE_EXTERNAL_APPLE_CLIENT_ID` da değişmeli.

## E-posta (SMTP ve şablonlar)

Doğrulama ve şifre sıfırlama postaları Zoho Mail'den `noreply@lykiva.app` adresiyle gider. Şablonlar Türkçe ve
yalnızca kod içerir; web'de yayımlanır, Supabase Auth (GoTrue) onları adresinden okur:

| Posta | Dosya | Adres |
| --- | --- | --- |
| Kayıt doğrulama | `apps/web/public/eposta/dogrulama.html` | `https://lykiva.app/eposta/dogrulama.html` |
| Hesaba e-posta ekleme (geçici hesaptan kayıt) | `apps/web/public/eposta/eposta-degisim.html` | `https://lykiva.app/eposta/eposta-degisim.html` |
| Şifre sıfırlama | `apps/web/public/eposta/sifre.html` | `https://lykiva.app/eposta/sifre.html` |

Şablon değişirse web yeniden yayımlanınca geçerli olur (GoTrue şablonu önbelleğe alır; hemen görmek için auth servisini
yeniden başlat).

### Coolify > lykiva-supabase > Environment Variables — 11 Kasım 2026 itibarıyla dolduruldu

Şablondaki hazır değişkenler:

```
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
DISABLE_SIGNUP=false
SMTP_HOST=smtp.zoho.eu
SMTP_PORT=465
SMTP_USER=noreply@lykiva.app
SMTP_PASS=<Zoho uygulama şifresi — buraya, repoya ya da sohbete yazılmaz>
SMTP_ADMIN_EMAIL=noreply@lykiva.app
SMTP_SENDER_NAME=Lykiva
```

Zoho AB veri merkezinde olduğu için sunucu `smtp.zoho.eu`. Gönderen adres (`SMTP_ADMIN_EMAIL`) giriş yapılan adresle
aynı olmalı, yoksa Zoho postayı reddeder. Hesapta iki adımlı doğrulama açıksa Zoho > Security > App Passwords'ten
uygulama şifresi alınır. 465 çalışmazsa `SMTP_PORT=587`.

### Şablon, konu ve kod süresi — 11 Kasım 2026 itibarıyla yapıldı

Coolify'ın Supabase şablonunda `MAILER_TEMPLATES_*` ve `MAILER_SUBJECTS_*` değişkenleri zaten compose'a bağlı;
Environment Variables'ta dolduruldu:

```
MAILER_TEMPLATES_CONFIRMATION=https://lykiva.app/eposta/dogrulama.html
MAILER_TEMPLATES_EMAIL_CHANGE=https://lykiva.app/eposta/eposta-degisim.html
MAILER_TEMPLATES_RECOVERY=https://lykiva.app/eposta/sifre.html
MAILER_SUBJECTS_CONFIRMATION=Lykiva doğrulama kodun
MAILER_SUBJECTS_EMAIL_CHANGE=Lykiva doğrulama kodun
MAILER_SUBJECTS_RECOVERY=Lykiva şifre sıfırlama kodun
```

Kod süresi ve uzunluğu için `supabase-auth` compose'una iki satır eklendi (Coolify API ile):

```yaml
      - 'GOTRUE_MAILER_OTP_EXP=${MAILER_OTP_EXP:-3600}'
      - 'GOTRUE_MAILER_OTP_LENGTH=${MAILER_OTP_LENGTH:-6}'
```

Şablonlarda "Kod 1 saat geçerli" yazıyor; 3600 sn bununla eşleşir. Uzunluk değişirse uygulama 6–10 haneyi kabul eder.
Değişiklikten sonra servisi yeniden başlat; ardından `node scripts/sunucu-kontrol.mjs` ve uygulamadan bir hesap açıp
kodun geldiğini dene (spam klasörüne de bak).
