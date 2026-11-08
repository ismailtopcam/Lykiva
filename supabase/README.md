# Supabase

`migrations/` altındaki SQL dosyaları veritabanı şemasıdır.

**Durum:** `20261107000000_ilk_sema.sql` bir taslaktır; henüz hiçbir Supabase projesine uygulanmadı.
Tüm tablolarda satır düzeyi güvenlik (RLS) açık ama politika yok — yani istemciden erişim kapalı.
Politikalar ve uygulama 2. aşamada yapılacak.

Uygulamak için (2. aşamada):

1. supabase.com'da proje oluştur (bölge: Avrupa — Frankfurt yakın).
2. `npx supabase login` ve `npx supabase link --project-ref <proje-ref>`
3. `npx supabase db push`
