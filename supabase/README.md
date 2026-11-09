# Supabase

Kendi sunucumuzda (Coolify, `lykiva-supabase` servisi): https://api.lykiva.ismailtopcam.dev

`migrations/` altındaki SQL dosyaları sırayla uygulanır. "Sunucuda" sütunu elle tutulur ve geride kalabilir;
gerçek durum için aşağıdaki `uygula.sh` (durum modu) ya da `node scripts/sunucu-kontrol.mjs` kullanılır.

| Dosya | İçerik | Sunucuda |
| --- | --- | --- |
| `20261107000000_ilk_sema.sql` | Tablolar, PostGIS, RLS açık | uygulandı |
| `20261108000000_kayit_ve_kurallar.sql` | Profil tetikleyicisi, aktivite/rota/takip kuralları, `kaydet_aktivite`, `aktivite_detay`, `aktivite_ozetleri` | uygulandı (8 Kasım 2026) |
| `20261109000000_giris.sql` | Hesap devri: `devir_kodu_al`, `hesabi_devral` (geçici hesaptaki kayıtları asıl hesaba taşır) | doğrulanmadı — `uygula.sh` ile bak |
| `20261109010000_rotalar.sql` | `kaydet_rota`, `aktiviteden_rota`, `rota_ozetleri`; aktiviteye `route_id` | uygulandı (8 Kasım 2026) |
| `20261109020000_paylasim.sql` | `aktivite_noktalari` (GPX dışa aktarımı; yalnızca sahibi nokta alır) | uygulandı (8 Kasım 2026, elle) |
| `20261109030000_gruplar.sql` | Grup / üyelik / sohbet kuralları, davet kodu, katılma istekleri, okundu bilgisi, gruba rota paylaşma, "gruplar" görünürlüğü; `messages` Realtime yayınında | doğrulanmadı — `uygula.sh` ile bak |
| `20261109040000_etkinlikler.sql` | Etkinlik ve katılım kuralları, `etkinlik_olustur`, `etkinlik_detay`, `katilim_bildir` (kontenjan + bekleme listesi), `grup_etkinlikleri`, `yaklasan_etkinlikler`, `etkinlik_sil` | doğrulanmadı — `uygula.sh` ile bak |
| `20261109050000_canli_konum.sql` | Canlı konum kuralları (yalnızca grup üyeleri, 15 dk tazelik), `canli_konum_gonder`, `canli_konum_bitir`, `grup_canli_konumlari`, `grup_canli_sayisi`; gruptan ayrılınca paylaşım silinir | doğrulanmadı — `uygula.sh` ile bak |
| `20261110000000_akis_takip.sql` | Akış (`akis`: takip ettiklerim / gruplarım / yakınımda, sayfalı), `kisi_profili`, `kisi_ara` (geçici hesaplar görünmez), `takip_listesi`; hesap devrinde takipler, grup üyelikleri, etkinlik katılımları ve mesajlar da taşınır | **henüz uygulanmadı** |
| `20261110010000_yorumlar.sql` | Yorumlar: `yorum_yaz` (1–1000 karakter, dakikada en fazla 10), `yorum_sil` (yazan ya da aktivitenin sahibi), `aktivite_yorumlari`, `aktivite_sosyal` (beğeni / yorum sayısı); tabloya doğrudan yorum yazma kapalı | **henüz uygulanmadı** |
| `20261110020000_paylasim_baglantisi.sql` | Web paylaşım bağlantısı: `paylasim_baglantisi_ac` / `paylasim_baglantisi` / `paylasim_baglantisi_kapat` (yalnızca sahibi), `paylasilan_aktivite(anahtar)` (anon okur; iz kırpılmış, kimlik yok); anahtarlar istemciye kapalı `aktivite_baglantilari` tablosunda | **henüz uygulanmadı** |
| `20261110030000_bildirimler.sql` | Uygulama içi bildirimler: `bildirimler` tablosu (tetikleyicilerle yazılır: takip, beğeni, yorum, katılma isteği / kabulü, grupta etkinlik), `bildirimlerim`, `bildirim_sayisi`, `bildirimleri_okundu_say`; `istegi_yanitla` ve `hesabi_devral` güncellendi; tablo Realtime yayınında | **henüz uygulanmadı** |

Tüm tabloların kuralları yazıldı (son: canlı konum, `20261109050000_canli_konum.sql`). Gruplar ve mesajlar `20261109030000_gruplar.sql` ile açılır.

Takip etme / bırakma ve beğeni doğrudan tablo yazımıyla yapılır (`follows`, `activity_likes`; kurallar `20261108000000`'de).
Yorum ise yalnızca `yorum_yaz` / `yorum_sil` ile yazılır ve silinir (uzunluk ve hız sınırı atlanamasın diye).

**Gizlilik:** Ham GPS noktalarını yalnızca sahibi okur. Başkalarına gösterilen iz, `hide_endpoints`
açıksa baştan ve sondan 200 m kırpılır (ev / iş adresi görünmesin diye).

## Migration'ları uygulamak

Coolify > Terminal > `uygulama` sunucusu. Önce durumu gör (hiçbir şey değiştirmez):

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
akış süzgeçleri, görünürlük kuralları, baş/son 200 m kırpma, beğeni, sayfalama, kişi arama, hesap devri, yorumlar, paylaşım bağlantısı, bildirimler, yetkiler.
Gerçek Supabase'in birebir aynısı değildir (GoTrue, Realtime yok). Yeni migration eklenince senaryoları da eklenmeli.

## Sunucuyu Mac'ten kontrol etmek

`apps/mobile/.env` içindeki anahtarla, yalnızca okuyarak: giriş ayarları (geçici hesap, Google, Apple),
her migration'ın sunucuda olup olmadığı ve Realtime bağlantısı.

```bash
node scripts/sunucu-kontrol.mjs
```

## Giriş

Geçici (anonim) giriş açık (`ENABLE_ANONYMOUS_USERS=true`). Uygulama Google ve Apple girişini kullanır:

- **Apple** (yalnızca iOS): telefonun kendi penceresi, kimlik jetonu `signInWithIdToken` / `linkIdentity` ile verilir.
  Apple tarafında gizli anahtar (secret) gerekmez; sadece bundle id.
- **Google**: Supabase'in `/auth/v1/authorize` sayfası uygulama içi tarayıcıda açılır, dönüş `lykiva://giris-donus`.
- Geçici hesaptaysa yeni hesap açılmaz, kimlik bu hesaba bağlanır (manual linking açık olmalı).
  Kimlik başka bir hesaptaysa asıl hesaba girilir ve `hesabi_devral` ile kayıtlar taşınır.

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
- **Google kapalı.** Açmak için Coolify > lykiva-supabase > Environment Variables'ta `GOOGLE_CLIENT_ID`, `GOOGLE_SECRET` doldurulur, `ENABLE_GOOGLE_SIGNIN=true` yapılır ve servis yeniden başlatılır.
- Bundle id değişirse `APPLE_CLIENT_ID` değişkeni güncellenmeli.

- Google Cloud Console: OAuth istemcisi türü **Web application**, yetkili yönlendirme adresi
  `https://api.lykiva.ismailtopcam.dev/auth/v1/callback`.
- Apple Developer: `app.lykiva.mobile` App ID'sinde **Sign in with Apple** açık olmalı (ücretli hesapla Xcode'un otomatik imzalaması bunu kendisi açar).
  Bundle id değişirse `GOTRUE_EXTERNAL_APPLE_CLIENT_ID` da değişmeli.
