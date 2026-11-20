# 3B kart video servisi (`kart-video`)

Paylaş ekranındaki 3B kartların (tasarım: `tasarim/` 11–17) hareketli hâlini MP4 olarak üretir. Sahne
MapLibre GL JS ile başsız Chromium'da açılır, her kare için zaman ilerletilip ekran görüntüsü alınır, ffmpeg
H.264 MP4'e çevirir (Instagram / WhatsApp oynatır).

**Durum (17 Kas 2026):** yayında. Coolify'da `video` uygulaması (sunucu "uygulama", 3 çekirdek / 3 GB), önünde kapı:
`https://video.ismailtopcam.dev` (uygulama anahtarı; yeni iş IP başına dakikada 1). Telefon Paylaş ekranındaki 3B video
temalarından çağırır (`apps/mobile/src/lib/kartVideo.ts`, adres `EXPO_PUBLIC_VIDEO_URL`). Servis yalnızca telefonun
gönderdiği izi ve metni işler; veritabanına bağlanmaz, videoyu `KV_SAKLA_DK` (60 dk) sonra siler.
Coolify'da GitHub App'e bağlı (17 Kas 2026): `altyapi/kart-video/**`, `altyapi/docker-compose.yml` ya da `altyapi/kapi/**`
`main`'e birleşince kendiliğinden yeniden kurulur.
Aşamalar: DEV_NOTES > "Paylaşım kartları — tasarım aktarımı".

## Neden böyle

- **Veri telefondan gelir:** telefon izi (gizlilik ayarına göre uçları kırpılmış, en fazla 5000 nokta) ve
  kullanıcının dilindeki metinleri gönderir. Servis veritabanına bağlanmaz, anahtar tutmaz.
- **Harita ve arazi açık kaynaklardan, her aktivite için hazırlık gerekmez:** harita ve binalar OpenFreeMap
  (uygulamanın haritasıyla aynı, OpenMapTiles şeması), arazi Mapzen Terrarium (AWS Open Data). Tasarımdaki
  three.js sayfaları her rota için önceden hazırlanmış harita dokusu ve yükseklik haritası istiyordu; doku için
  kullanılan OpenTopoMap / Esri ticari kullanımda lisans gerektiriyor.
- **Kart yazısı yok:** haritanın yer adları kapalı (dilden bağımsız, sade). Kaynak satırı her videoda.

## Şablonlar

| Tema | Tasarım | Biçim (varsayılan) | Süre | Ne olur |
| --- | --- | --- | --- | --- |
| `yorunge` | 11, 12, 16 | hikâye, gönderi | 15 sn | 0–0,8 düz harita · 0,8–7,3 rota çizilir · 6,8–9,8 eğilir, arazi yükselir · 8,8–13,3 kamera döner · 13,3–15 bekler |
| `sehir-gece` | 13 | hikâye, gönderi | 15 sn | Koyu harita; eğilirken binalar yükselir (zamanlama yörüngeyle aynı) |
| `sehir-maket` | 14 (15) | gönderi, hikâye | 15 sn | Beyaz maket şehir (15'in uydu görüntüsü lisans gerektirdiği için açık harita) |
| `takip` | 17 | gönderi, hikâye | 20 sn | 0–1,5 üstten · 1,5–4 kamera rotanın arkasına iner · 4–16 izler · 16–18,2 geri çekilir · 18,2–20 bekler |

Zamanlama (20 Kas 2026): rota çizimi ve izleme uçlarda yumuşak, ortada en çok ortalamanın 1,5 katı hızda (`akici`;
eskiden kübik eğriyle ortası 3 kat hızlıydı ve 26 km 4 sn'de çiziliyordu). Evreler yarım saniye örtüşür; sonda
değerlerin okunması için ~1,7 sn bekleme var. Sondaki bekleme kare çizdirmez (son kare tekrarlanır), üretim süresine
yalnız hareketli kısım eklenir: yörüngede çizilen süre 11 → 12,5 sn, takipte 15 → 18,2 sn.

Hıza göre akış: gövdede `hiz` (her noktada km/sa) varsa çizgi ve takip kamerası rotada kullanıcının hızıyla ilerler,
km sayacı da onunla artar (`zamanTablosu`, `izOrani`). İzlenebilir kalsın diye hız rota boyunca yumuşatılır
(±%3 rota, 150–600 m) ve hareketli ortalamanın 0,4–2,5 katına sıkıştırılır: molada animasyon durmaz, hızlı iniş bir
anda geçip gitmez. Toplam süre değişmez. `hiz` yoksa (eski uygulama, hızı gizli aktivite) düz hızla akar.
Örnek aktivitenin hız profiliyle (12–44 km/sa) rotanın her %10'u animasyonun %3,6–14,7'sini alıyor.

Harita kabı iki kat CSS boyutunda çizilip yarıya küçültülür (`sahne.css > #harita`): kart 360 pt genişlikte olduğu
için aksi hâlde harita bir seviye uzak kalıyor, binalar (z14+) gelmiyordu.

## API

```
POST /video          { tema, bicim?, rota: [[boylam, enlem], …], hiz?: [km/sa, …] (rotayla aynı uzunlukta),
                       metin: { ust, baslik, kmSayi, kmBasamak, ondalik,
                       kmBirim, degerler: [{ etiket, deger }] (en fazla 3), kaynak } }        → 202 { id }
GET  /video/:id      → { durum: sirada | uretiliyor | hazir | hata, ilerleme: 0–1, sira?, hata? }
GET  /video/:id/mp4  → video/mp4
GET  /saglik         → { durum: "ok", sira, calisiyor }
```

İşler bellekte, tek tek üretilir; video `KV_SAKLA_DK` (60) dakika sonra silinir. Sıra `KV_EN_FAZLA_SIRA` (20)
dolunca 503. Kimlik doğrulama ve istek sınırı önündeki kapıda olacak (BRouter / Photon gibi uygulama anahtarı).

## Ayarlar (ortam)

| Değişken | Varsayılan | Ne |
| --- | --- | --- |
| `PORT` | 8080 | |
| `KV_FPS` | 24 | kare hızı |
| `KV_OLCEK` | 2 | çizim ölçeği (hikâye 720×1280 çizilir, çıkışta 1080×1920'ye büyütülür) |
| `KV_HARITA_ORAN` | 0.75 | haritanın çözünürlük çarpanı (yazılar etkilenmez) |
| `KV_ARAZI` | 1 | yörünge / takipte 3B arazi; 0 → eğik harita + tepe gölgesi, ~3 kat hızlı |
| `KV_AA` | 0 | kenar yumuşatma (yazılım WebGL'de çok pahalı) |
| `KV_SADE` | 1 | sade stil (yalnız zemin, yeşil alan, su, ana yollar) |
| `KV_GOLGE` | 1 | tepe gölgesi |
| `KV_GL` | swiftshader | ekran kartı yoksa yazılımla WebGL; ekran kartlı makinede `gpu` |
| `KV_CIKTI` | /tmp/kart-video | videoların yazıldığı klasör |
| `KV_SAKLA_DK` | 60 | |
| `KV_EN_FAZLA_SIRA` | 20 | |

## Hız (15 Kas 2026, sunucu "uygulama", 3 çekirdek, yazılım WebGL)

İlk sürüm 12 sn'lik hikâyeyi sunucuda **18 dk**'da üretti (yerelde 3,7 dk). Kare başına ölçüm (`sunucu_olc`):

| Ayar | Düz kare | Eğik kare |
| --- | --- | --- |
| İlk sürüm (kenar yumuşatma açık, arazi hep açık) | 2,2 sn | 2,7–3,5 sn |
| Kenar yumuşatma kapalı, harita ×0,75 | 1,5 sn | 1,6–2,0 sn |
| + düz karelerde arazi kapalı, rota değişmezse kaynağa dokunulmaz | 0,3–0,5 sn | 1,8 sn |
| + 3B arazi kapalı | 0,3–0,6 sn | 0,6–0,8 sn |

- Maliyet piksel sayısından çok 3B araziden geliyor (harita çözünürlüğünü yarıya indirmek eğik karede ~%10 kazandırıyor).
- Ekran görüntüsü süresi asıl çizimi de içerir (yazılım WebGL çizimi görüntü okunurken tamamlanır).
- Denendi, işe yaramadı: `toDataURL` ile tuvali okumak (aynı süre), arazi karosunu 512 yapmak (daha yavaş),
  stili sadeleştirmek (eğik karede fark yok; düz karede az), yazı kutularındaki bulanıklığı kaldırmak.
- Şehir şablonlarında arazi kapalı (3B etkisini binalar verir).

## Yerelde deneme

```bash
cd altyapi/kart-video
npm install
npx playwright install chromium
node src/deneme.js kas-kalkan yorunge hikaye                 # → cikti/kas-kalkan-yorunge-hikaye.mp4
node src/deneme.js izmir-kordon sehir-gece --kareler 2,6,11   # yalnız birkaç kare (JPEG), hızlı bakmak için
```

Örnek rotalar `ornek/` (BRouter ile hesaplandı): `kas-kalkan` (25,9 km), `izmir-kordon` (2,8 km), `istanbul` (3,1 km).
ffmpeg PATH'te olmalı (`KV_FFMPEG` ile yolu verilebilir).
