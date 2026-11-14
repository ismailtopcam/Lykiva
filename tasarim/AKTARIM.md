# Tasarım aktarımı — Lykiva paylaşım kartları ve ekranlar

Bu klasör, claude.ai'deki "Lykiva — Mobil Uygulama" tasarım projesinin tamamının dışa aktarılmış hâlidir
(15 Kasım 2026, son yayımlanan sürüm). Claude Code bu dosyadan başlayarak paylaşım kartlarını uygulamaya taşıyacak.

> **Çalışma kuralı (İsmail):** Kodda değişiklik yapmadan önce her aşamanın planını sun, onay al.
> Örnek rakamları gerçekmiş gibi gösterme; ulaşamadığın bir kaynak olursa söyle.

## Klasör haritası

```
tasarim/
├── AKTARIM.md                     ← bu dosya
├── kaynak/                        ← tasarım aracındaki dosyaların birebir kopyası (yalnız görsel yolları yerelleştirildi)
│   ├── canvas.json                ← tüm çalışma alanı: kart başlıkları, ölçüler, notlar, güvenli alan kılavuzları
│   ├── Kart01…Kart17-*.dc.html    ← 17 paylaşım kartı
│   └── Main, Profil, KayitBaslat… ← 18 uygulama ekranı (README'ye göre koda zaten dökülmüş; referans)
├── paylasim-kartlari/
│   ├── onizleme/KartNN-*.html     ← her kart tek başına açılan HTML (pencereye sığacak şekilde küçülür)
│   ├── gorseller/KartNN-*.jpg     ← her kartın 1080 px genişlikte durağan görüntüsü (animasyonun son karesi)
│   └── varliklar/                 ← harita dokuları, yükseklik haritaları, three.min.js (r15x, MIT)
└── uretim/                        ← kartları üreten Python betikleri + rota koordinatları (veri/*.txt)
```

`.dc.html` dosyaları tasarım aracının biçimidir (`<x-dc>`, `<helmet>`, `{{ }}` şablonları, `class Component extends DCLogic`).
Tarayıcıda doğrudan çalışmazlar; görmek için `paylasim-kartlari/onizleme/` kullan. Ölçü, renk ve yazı için kaynak doğrudur.

## Önizlemeleri açmak

- **2B kartlar (01–10):** `onizleme/` içindeki dosyaya çift tıkla.
- **3B kartlar (11–17):** yerel sunucu gerekir (tarayıcı `file://` ile açılan sayfada yükseklik görselinin piksellerini okutmaz):
  ```bash
  cd tasarim/paylasim-kartlari
  npx serve .            # ya da: python -m http.server 8000
  ```
  sonra `http://localhost:3000/onizleme/Kart13-IzmirGece.html` (python ile `:8000`).
- Yazı tipleri Google Fonts'tan gelir (internet gerekir): **Bricolage Grotesque** (başlık/rakam), **Inter** (gövde).

## Ölçüler ve güvenli alanlar (Instagram)

| Biçim | Piksel | Not |
|---|---|---|
| Hikâye | 1080×1920 (9:16) | Üst ~250 px ve alt ~250 px'i Instagram arayüzü kapatır → yazı/logo içeride (kırmızı kılavuz) |
| Gönderi | 1080×1350 (4:5) | Profil ızgarası 3:4 gösterir → kenarlardan ~34 px kırpılır (yeşil kılavuz) |
| Kare | 1080×1080 | — |

Kartlar içeride "tasarım pikseli" ile çizilir ve `transform: scale(k)` ile 1080'e büyütülür
(hikâye k=3 → 360×640, gönderi/kare k=2,5 → 432×540 / 432×432). 3B tuval (canvas) ise doğrudan 1080 çözünürlükte.

## Renkler

| Ad | Değer | Kullanım |
|---|---|---|
| INK | `#16201B` | koyu metin, koyu zemin |
| CREAM | `#F2EDE3` | açık zemin, koyu üstünde metin |
| SURF | `#FBF8F2` | kart yüzeyi, rota kenarı |
| TERRA | `#B04E25` | ana vurgu (kiremit), açık zeminde rota |
| ORANGE | `#E07A4A` | koyu zeminde rota ve vurgu |
| SEA | `#0B6A6A` | deniz/ikincil vurgu |
| NIGHT | `#0E1512` | gece zemini |

Mobil koddaki karşılıkları `apps/mobile/src/theme` ve `PaylasimKarti.tsx` içindeki `KART_SABLONLARI`.

## Kart kataloğu

| # | Ad | Biçim | Tür | İçerik / animasyon |
|---|---|---|---|---|
| 01 | Gece haritası | Hikâye | 2B | Koyu topo harita (OpenTopoMap, filtreyle gece), rota çizilir |
| 02 | Zirve profili | Gönderi | 2B | Yükseklik profili dağ silueti, en yüksek nokta etiketi |
| 03 | Kartpostal | Kare | 2B | Pul + damga, rota pulun içinde |
| 04 | Biniş kartı | Hikâye | 2B | Uçak bileti düzeni, yükseklik "barkodu" çubuk çubuk büyür |
| 05 | Minimal tipografi | Gönderi | 2B | Dev mesafe rakamı, ince rota |
| 06 | Fotoğrafın üstünde | Hikâye | 2B | Kullanıcı fotoğrafı yeri + rota + istatistik kutusu |
| 07 | Birlikte | Kare | 2B | Grup aktivitesi: avatar halkaları, "4 kişi, 1 rota" |
| 08 | Harita posteri | Gönderi | 2B | Gerçek harita üstünde rota, poster altlığı, koordinatlar |
| 09 | Hız haritası | Hikâye | 2B | Rota hıza göre renkli (3 kademe), lejant |
| 10 | Günün akışı | Hikâye | 2B | Zaman çizelgesi: başlangıç, molalar, varış |
| 11 | 2B → 3B | Hikâye | 3B | Kaş–Kalkan; düz harita → eğilir, dağlar yükselir, kamera döner |
| 12 | 2B → 3B | Gönderi | 3B | 11'in gönderi sürümü, açık tema |
| 13 | İzmir Kordon | Hikâye | 3B | Gece şehir, binalar yükselir, km sayacı |
| 14 | İstanbul | Gönderi | 3B | Sultanahmet → Galata, beyaz maket şehir |
| 15 | Antalya | Kare | 3B | Kaleiçi → Konyaaltı, uydu görüntüsü + binalar |
| 16 | Faralya → Kabak | Hikâye | 3B | Dağ: Babadağ, Kelebekler Vadisi |
| 17 | Kaş – Kalkan | Gönderi | 3B | Kamera rotanın arkasından izler (Relive tarzı) |

### Animasyon zamanlamaları
- **2B (01–10):** 8 sn döngü. Rota `pathLength="1"` + `stroke-dashoffset` ile baştan sona çizilir; uç noktası `offset-path` ile ilerler;
  profil/çubuklar `scaleX`/`scaleY` ile açılır. `prefers-reduced-motion` desteklenir.
- **3B yörünge (11–16):** 12 sn döngü — 0–4 sn düz haritada rota çizilir · 4–7 sn harita eğilir, yükseklik 0,02×'ten "abartı"ya çıkar ·
  7–11 sn kamera yavaşça döner · 11–12 sn bekler.
- **3B takip (17):** 16 sn döngü — 0–2 sn üstten düz · 2–4 sn yükselir, kamera rotanın arkasına iner · 4–13 sn rotayı izler ·
  13–15 sn geri çekilip tüm rotayı gösterir · 15–16 sn bekler.
- Alt kutudaki km sayacı rota çizildikçe 0'dan toplam mesafeye çıkar (13–17).

## 3B kartların tekniği (three.js)

Ortak mantık her 3B kartın `<script data-dc-script>` bölümünde (`uretim/sehir3d.py` → `LOGIC`). Özet:

1. **Yükseklik haritası:** gri PNG, `gri/255 × maxH` metre. Birim sistemi "harita pikseli": yükseklik `metre / mpp` ile piksele çevrilir.
   `PlaneGeometry(MW, MH, GX-1, GY-1)`, köşe z'leri yükseklikten; doku = harita görseli.
2. **Abartı:** arazi grubunun `scale.z`'si. Kullanıcı ayarı (`abarti`) 1–4.
3. **Rota:** `veri/*_px.txt` → harita pikseli (x,y). Düz `CatmullRomCurve3` + `TubeGeometry`; yükseklik gölgelendiricide eklenir
   (`aH` özniteliği × `uSz`) — böylece tüp kesiti abartıyla dikeyde gerilmez. Kenar tüpü `BackSide` ile çizilir → renkli çizginin çevresinde ince beyaz kontur.
   `setDrawRange` ile çizim ilerler.
4. **Deniz düzlemi:** haritanın dışını deniz rengiyle doldurur (kamera eğilince kenar boşluğu görünmesin). Sis (`Fog`) uzakları zemine karıştırır.
5. **Performans:** `IntersectionObserver` — tuval ekranda değilse WebGL bağlamı kapatılır (aynı sayfada çok sayıda 3B kart tarayıcı sınırını aşmasın).

| Kart | Harita dokusu | Yükseklik | Harita px | Izgara | maxH (m) | m/px | Rota |
|---|---|---|---|---|---|---|---|
| 11, 12, 17 | kas-harita.jpg (OpenTopoMap Z13) | kas-yukseklik.png | 1590×1390 | 398×348 | 1700 | 15,4 | bike_px.txt |
| 13 | izmir-doku.jpg (Esri koyu, Z16) | izmir-yukseklik.png | 1150×1700 | 575×850 | 200 | 1,871 | izmir_px.txt |
| 14 | istanbul-doku.jpg (Esri açık, Z16) | istanbul-yukseklik.png | 1300×1500 | 650×750 | 120 | 1,803 | istanbul_px.txt |
| 15 | antalya-doku.jpg (Esri uydu, Z15, kırpılmış) | antalya-yukseklik.png | 1200×1200 | 600×600 | 150 | 3,821 | antalya_px.txt (−200, −100 kaydırılır) |
| 16 | faralya-doku.jpg (OpenTopoMap Z14) | faralya-yukseklik.png | 1300×1500 | 650×750 | 2000 | 7,68 | faralya_px.txt |

Şehir yükseklik haritaları = arazi (Terrarium) + OpenStreetMap bina izdüşümleri (`height` etiketi, yoksa `kat × 3,2 + 1`, yoksa **12 m varsayım**).
Bina rengi doku görseline işlenmiştir (İzmir: açık arduvaz, İstanbul: krem-beyaz).

## Rakamlar: gerçek mi örnek mi

- **Gerçek:** rota geometrileri (BRouter ile hesaplandı) ve 13–17'deki mesafeler (2,77 · 2,91 · 6,37 · 5,63 · 26,45 km), Faralya'nın tırmanış/iniş/süresi (BRouter tahmini).
- **Örnek:** 01–12'deki "27,4 km · 1:38 · 412 m · 48,2" uygulamanın örnek aktivitesinden (gerçek Kaş–Kalkan rotası ≈26,5 km); 13–15 süreleri tipik hızdan
  hesaplandı (koşu 5:30/km, yürüyüş 4,5 km/sa, bisiklet 16 km/sa); kişi adları, tarihler, saatler örnek. 09'daki hız renkleri yükseklikten tahmin.
- Uygulamada **bütün değerler gerçek aktivite verisinden** gelmeli.

## Kaynaklar ve lisanslar (uygulamaya geçmeden kontrol edilmeli)

| Veri | Kaynak | Not |
|---|---|---|
| Topo harita | OpenTopoMap | CC-BY-SA; kaynak gösterimi zorunlu; yoğun ticari kullanım için kendi karo sunucusu önerilir |
| Şehir haritaları | Esri Canvas (World Dark/Light Gray) | Esri kullanım koşulları — ticari kullanım için lisans/hesap gerekebilir |
| Uydu (15) | Esri World Imagery | **Lisans gerekir**; alternatif: açık uydu kaynağı ya da kart 15'i harita dokusuyla yapmak |
| Binalar | OpenStreetMap / Overpass API | ODbL; Overpass kamuya açık uç noktalarının kullanım sınırları var → üretimde kendi Overpass'ı ya da önceden işlenmiş veri |
| Yükseklik | Mapzen Terrarium (AWS Open Data, SRTM vb.) | Açık; kaynak gösterimi |
| Rota | BRouter | Projenin kendi BRouter'ı: `brouter.ismailtopcam.dev` (15 Kasım itibarıyla `/brouter` 403 dönüyordu) |

Her kartın altında küçük puntoyla kaynak satırı var; uygulamada da korunmalı.

## Uygulamaya taşıma — önerilen yol (onaya sunulacak plan taslağı)

Bugünkü durum: `apps/mobile/src/components/PaylasimKarti.tsx` (4 şablonlu basit kart + `HikayeGorseli` 9:16) ve
`apps/mobile/src/app/aktivite/[id]/paylas.tsx` (şablon seçimi, istatistik açma/kapama, `react-native-view-shot` ile yakalama, `expo-sharing`).

1. **2B kartlar (durağan görsel):** 01–10'u `react-native-svg` bileşenleri olarak yaz, `paylas.tsx`'teki şablon seçicisine ekle.
   Veriler: rota `aktivite_noktalari` RPC'sinden, istatistikler aktiviteden; "uçları kırp" gizlilik seçeneği korunmalı.
   Harita zemini gereken kartlar (01, 08, 09) için MapLibre anlık görüntüsü ya da sunucuda karo birleştirme. 1080 px yakala.
2. **Hareketli paylaşım (video):** Instagram'a animasyonlu paylaşım için MP4 gerekir. Seçenekler:
   (a) sunucuda başsız Chromium ile bu HTML'leri kare kare çekip ffmpeg ile video; (b) cihazda Skia/expo-gl ile çizip kaydetmek.
   Karar İsmail'in — artı/eksileri sun.
3. **3B kartlar:** her aktivite için veri hazırlığı gerekir (rota çevresi Terrarium karoları, gerekiyorsa OSM binaları, harita dokusu).
   Seçenekler: (a) sunucuda hazırlayıp video üret (2a ile aynı boru hattı); (b) cihazda `expo-gl` + three.js. Hesaplama ağır; önce sunucu tarafı önerilir.

Her aşamada küçük, test edilebilir PR; `packages/shared` içindeki rota/istatistik fonksiyonlarını (vitest) kullan ve genişlet.

## Yeniden üretim (gerekirse)

`uretim/` betikleri `.dc.html` kartlarını üretir (`python sehir3d.py <çıktı_kökü>` → `<çıktı_kökü>/project/...`).
Dikkat: yayımlanan sürümde elle yapılmış düzeltmeler olabilir (ör. Kart11'de tuval konumu `left: 48px; top: -70px`);
**doğru kaynak `kaynak/` klasörüdür.** `hazirla.py`'nin ham girdileri (tarayıcıdan alınan harita/yükseklik ekran görüntüleri) bu klasörde yok;
işlenmiş çıktıları `paylasim-kartlari/varliklar/` içinde.
