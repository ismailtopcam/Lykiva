-- Tarihi yürüyüş: yeni aktivite türü (Likya, Karia, Frig… gibi işaretli tarihi yollarda yürüyüş).
-- Uygulama bu türü seçince haritada tarihi yürüyüş yollarını gösterir (apps/mobile/src/components/map/tarihiYollar.ts).
--
-- Değer enum'un sonuna eklenir. Kurallar ve fonksiyonlar türü `::activity_type` ile çevirdiğinden (kaydet_aktivite,
-- kaydet_rota, hedefler, meydan okumalar…) başka değişiklik gerekmez. `add value` işlem (transaction) içinde
-- çalışır; yeni değer aynı işlemde kullanılmadığı için uygula.sh'nin tek işlemde uygulamasıyla uyumlu.
alter type public.activity_type add value if not exists 'historic_hike';
