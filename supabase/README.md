# Supabase

Kendi sunucumuzda (Coolify, `lykiva-supabase` servisi): https://api.lykiva.ismailtopcam.dev

`migrations/` altındaki SQL dosyaları sırayla uygulanır:

| Dosya | İçerik | Sunucuda |
| --- | --- | --- |
| `20261107000000_ilk_sema.sql` | Tablolar, PostGIS, RLS açık | uygulandı |
| `20261108000000_kayit_ve_kurallar.sql` | Profil tetikleyicisi, aktivite/rota/takip kuralları, `kaydet_aktivite`, `aktivite_detay`, `aktivite_ozetleri` | uygulandı (8 Kasım 2026) |
| `20261109010000_rotalar.sql` | `kaydet_rota`, `aktiviteden_rota`, `rota_ozetleri`; aktiviteye `route_id` | uygulandı (8 Kasım 2026) |

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

Şimdilik geçici (anonim) giriş açık (`ENABLE_ANONYMOUS_USERS=true`). Google ve Apple girişi geldiğinde
anonim hesaplar onlara bağlanacak.
