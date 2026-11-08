# Supabase

Kendi sunucumuzda (Coolify, `lykiva-supabase` servisi): https://api.lykiva.ismailtopcam.dev

`migrations/` altındaki SQL dosyaları sırayla uygulanır:

| Dosya | İçerik | Sunucuda |
| --- | --- | --- |
| `20261107000000_ilk_sema.sql` | Tablolar, PostGIS, RLS açık | uygulandı |
| `20261108000000_kayit_ve_kurallar.sql` | Profil tetikleyicisi, aktivite/rota/takip kuralları, `kaydet_aktivite`, `aktivite_detay`, `aktivite_ozetleri` | uygulandı (8 Kasım 2026) |
| `20261109000000_giris.sql` | Hesap devri: `devir_kodu_al`, `hesabi_devral` (geçici hesaptaki kayıtları asıl hesaba taşır) | **henüz uygulanmadı** |
| `20261109010000_rotalar.sql` | `kaydet_rota`, `aktiviteden_rota`, `rota_ozetleri`; aktiviteye `route_id` | uygulandı (8 Kasım 2026) |
| `20261109020000_paylasim.sql` | `aktivite_noktalari` (GPX dışa aktarımı; yalnızca sahibi nokta alır) | **henüz uygulanmadı** |
| `20261109030000_gruplar.sql` | Grup / üyelik / sohbet kuralları, davet kodu, katılma istekleri, okundu bilgisi, gruba rota paylaşma, "gruplar" görünürlüğü; `messages` Realtime yayınında | **henüz uygulanmadı** |
| `20261109040000_etkinlikler.sql` | Etkinlik ve katılım kuralları, `etkinlik_olustur`, `etkinlik_detay`, `katilim_bildir` (kontenjan + bekleme listesi), `grup_etkinlikleri`, `yaklasan_etkinlikler`, `etkinlik_sil` | **henüz uygulanmadı** |
| `20261109050000_canli_konum.sql` | Canlı konum kuralları (yalnızca grup üyeleri, 15 dk tazelik), `canli_konum_gonder`, `canli_konum_bitir`, `grup_canli_konumlari`, `grup_canli_sayisi`; gruptan ayrılınca paylaşım silinir | **henüz uygulanmadı** |

Tüm tabloların kuralları yazıldı (son: canlı konum, `20261109050000_canli_konum.sql`). Gruplar ve mesajlar `20261109030000_gruplar.sql` ile açılır.

**Gizlilik:** Ham GPS noktalarını yalnızca sahibi okur. Başkalarına gösterilen iz, `hide_endpoints`
açıksa baştan ve sondan 200 m kırpılır (ev / iş adresi görünmesin diye).

## Yeni bir migration uygulamak

Coolify > Terminal > `uygulama` sunucusu:

```bash
curl -fsSL https://raw.githubusercontent.com/ismailtopcam/Lykiva/main/supabase/migrations/<dosya>.sql \
  | docker exec -i supabase-db-nqyujqqkkjyba4flthzcf9uf psql -U postgres -v ON_ERROR_STOP=1 -1
```

## Giriş

Geçici (anonim) giriş açık (`ENABLE_ANONYMOUS_USERS=true`). Uygulama Google ve Apple girişini kullanır:

- **Apple** (yalnızca iOS): telefonun kendi penceresi, kimlik jetonu `signInWithIdToken` / `linkIdentity` ile verilir.
  Apple tarafında gizli anahtar (secret) gerekmez; sadece bundle id.
- **Google**: Supabase'in `/auth/v1/authorize` sayfası uygulama içi tarayıcıda açılır, dönüş `lykiva://giris-donus`.
- Geçici hesaptaysa yeni hesap açılmaz, kimlik bu hesaba bağlanır (manual linking açık olmalı).
  Kimlik başka bir hesaptaysa asıl hesaba girilir ve `hesabi_devral` ile kayıtlar taşınır.

### Sunucu ayarı (Coolify > lykiva-supabase)

Şablonda Google / Apple değişkenleri yok; **Edit Compose File** ile `supabase-auth` servisinin
`environment` listesine eklenmeli:

```yaml
      - GOTRUE_SECURITY_MANUAL_LINKING_ENABLED=true
      - GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
      - GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOTRUE_EXTERNAL_GOOGLE_SECRET=${GOOGLE_SECRET}
      - GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=https://api.lykiva.ismailtopcam.dev/auth/v1/callback
      - GOTRUE_EXTERNAL_APPLE_ENABLED=true
      - GOTRUE_EXTERNAL_APPLE_CLIENT_ID=app.lykiva.mobile
```

Sonra Environment Variables'a `GOOGLE_CLIENT_ID` ve `GOOGLE_SECRET` girilir, `ADDITIONAL_REDIRECT_URLS`
değerine `lykiva://giris-donus` eklenir (virgülle ayrılır) ve servis yeniden başlatılır.

- Google Cloud Console: OAuth istemcisi türü **Web application**, yetkili yönlendirme adresi
  `https://api.lykiva.ismailtopcam.dev/auth/v1/callback`.
- Apple Developer: `app.lykiva.mobile` App ID'sinde **Sign in with Apple** açık olmalı.
  Bundle id değişirse `GOTRUE_EXTERNAL_APPLE_CLIENT_ID` da değişmeli.
