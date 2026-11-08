# Supabase

Kendi sunucumuzda (Coolify, `lykiva-supabase` servisi): https://api.lykiva.ismailtopcam.dev

`migrations/` altındaki SQL dosyaları sırayla uygulanır:

| Dosya | İçerik | Sunucuda |
| --- | --- | --- |
| `20261107000000_ilk_sema.sql` | Tablolar, PostGIS, RLS açık | uygulandı |
| `20261108000000_kayit_ve_kurallar.sql` | Profil tetikleyicisi, aktivite/rota/takip kuralları, `kaydet_aktivite`, `aktivite_detay`, `aktivite_ozetleri` | uygulandı (8 Kasım 2026) |
| `20261109000000_giris.sql` | Hesap devri: `devir_kodu_al`, `hesabi_devral` (geçici hesaptaki kayıtları asıl hesaba taşır) | **henüz uygulanmadı** |

Gruplar, etkinlikler, mesajlar ve canlı konum tablolarının kuralları henüz yok — istemciden kapalılar.

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
