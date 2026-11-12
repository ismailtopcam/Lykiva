/**
 * Lykiva — migration denemesi (sunucuya dokunmaz).
 *
 *   npm run test:sql
 *
 * Bellekte PGlite + PostGIS ile boş bir veritabanı açar, Supabase'in auth şemasını ve rollerini
 * taklit eder, supabase/migrations/ altındaki tüm dosyaları sırayla uygular; sonra farklı
 * kullanıcılar adına akış, takip, beğeni, kişi arama ve hesap devri senaryolarını dener.
 * Gerçek Supabase'in birebir aynısı değildir (Realtime, GoTrue yok); kuralları ve fonksiyonları dener.
 */
import { PGlite } from '@electric-sql/pglite';
import { postgis } from '@electric-sql/pglite-postgis';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KLASOR = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const hataYaz = (e) => {
  console.log('HATA:', e.message, e.detail ?? '', e.where ?? '', e.position ? `konum ${e.position}` : '');
  process.exit(2);
};
process.on('unhandledRejection', hataYaz);
process.on('uncaughtException', hataYaz);
const db = new PGlite({ extensions: { postgis } });

const hazirlik = `
create schema if not exists extensions;
create schema if not exists auth;
create role anon nologin;
create role authenticated nologin;
create table auth.users (id uuid primary key, is_anonymous boolean not null default false, raw_user_meta_data jsonb default '{}', email text, created_at timestamptz not null default now(), last_sign_in_at timestamptz, banned_until timestamptz);
create function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
-- Supabase Storage'ın yalnızca kuralları ilgilendiren kısmı
create schema if not exists storage;
create table storage.buckets (id text primary key, name text not null, owner uuid, public boolean default false, file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now(), updated_at timestamptz default now());
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text, owner uuid default auth.uid(), created_at timestamptz default now(), metadata jsonb, unique (bucket_id, name));
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant select on storage.buckets to anon, authenticated;
grant usage on schema public, extensions, auth to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
set search_path = public, extensions;
alter database template1 set search_path = public, extensions;
`;
await db.exec(hazirlik);
await db.exec(`alter role authenticated set search_path = public, extensions; alter role postgres set search_path = public, extensions;`).catch(() => {});

const dosyalar = readdirSync(KLASOR).filter((f) => f.endsWith('.sql')).sort();
for (const f of dosyalar) {
  const sql = readFileSync(join(KLASOR, f), 'utf8');
  try {
    await db.exec('begin;' + sql + ';commit;');
    console.log('✓', f);
  } catch (e) {
    console.log('✗', f, '→', e.message);
    await db.exec('rollback;').catch(() => {});
    process.exit(1);
  }
}

// --------------------------------------------------------------------------
// Senaryolar
// --------------------------------------------------------------------------
const A = 'a0000000-0000-0000-0000-00000000000a';
const B = 'b0000000-0000-0000-0000-00000000000b';
const C = 'c0000000-0000-0000-0000-00000000000c';
const G = 'f0000000-0000-0000-0000-0000000000f0'; // geçici hesap (anonim)

await db.exec(`
  insert into auth.users (id, is_anonymous, raw_user_meta_data) values
    ('${A}', false, '{"full_name":"Ayşe Yılmaz"}'),
    ('${B}', false, '{"full_name":"Burak Demir"}'),
    ('${C}', false, '{"full_name":"Cem Kaya"}'),
    ('${G}', true, '{}');
`);
// handle_new_user tetikleyicisi auth.users üzerinde: profiller oluştu mu?
const prof = await db.query(`select id, display_name from profiles order by id`);
console.log('profiller:', prof.rows.map((r) => r.display_name).join(', '));

async function olarak(uid, sql, params = [], anonim = false) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ sub: uid, role: 'authenticated', is_anonymous: anonim })}', false);`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
  }
}

function iz(lng0, lat0, n = 60) {
  return Array.from({ length: n }, (_, i) => ({ t: 1762500000000 + i * 10000, lng: lng0 + i * 0.0005, lat: lat0 + Math.sin(i / 5) * 0.0005, alt: 100 + i }));
}
async function aktivite(uid, baslik, gorunurluk, lng0, lat0, gun) {
  const pts = iz(lng0, lat0).map((p) => ({ ...p, t: p.t + gun * 86400000 }));
  const p = {
    title: baslik, activity: 'bike', started_at: new Date(pts[0].t).toISOString(), ended_at: new Date(pts.at(-1).t).toISOString(),
    moving_time_s: 590, elapsed_time_s: 600, distance_m: 2500, elevation_gain_m: 59, elevation_loss_m: 0, max_elevation_m: 159,
    avg_speed_mps: 4.2, max_speed_mps: 8, min_moving_speed_mps: 1, visibility: gorunurluk, hide_endpoints: true, points: pts,
    stops: [{ startT: pts[10].t, endT: pts[12].t, lng: pts[10].lng, lat: pts[10].lat, distanceAtM: 400 }],
  };
  const r = await olarak(uid, `select kaydet_aktivite($1::jsonb) as id`, [JSON.stringify(p)]);
  return r.rows[0].id;
}

let hata = 0;
const bekle = (ad, kosul, ayrinti) => {
  console.log(kosul ? '  ✓' : '  ✗', ad, kosul ? '' : `→ ${JSON.stringify(ayrinti)}`);
  if (!kosul) hata++;
};

// Kaş civarı (29.6, 36.2) ve İstanbul (29.0, 41.0)
const aKas = await aktivite(A, 'A Kaş herkese açık', 'public', 29.6, 36.2, 0);
const aTakip = await aktivite(A, 'A takipçilere', 'followers', 29.6, 36.2, 1);
const aOzel = await aktivite(A, 'A özel', 'private', 29.6, 36.2, 2);
const bGrup = await aktivite(B, 'B gruplara', 'groups', 29.0, 41.0, 3);
const cIst = await aktivite(C, 'C İstanbul herkese açık', 'public', 29.0, 41.0, 4);
const gAkt = await aktivite(G, 'Geçici hesabın kaydı', 'public', 29.0, 41.0, 5);

console.log('\nAkış: takip');
let r = await olarak(B, `select akis('takip') as j`);
bekle('B kimseyi takip etmiyor: yalnızca kendi aktivitesi', r.rows[0].j.length === 1 && r.rows[0].j[0].id === bGrup, r.rows[0].j.map((x) => x.title));

await olarak(B, `insert into follows (follower_id, followee_id) values ($1, $2)`, [B, A]);
r = await olarak(B, `select akis('takip') as j`);
const basliklar = r.rows[0].j.map((x) => x.title);
bekle('B, A\'yı takip edince A\'nın açık + takipçi aktiviteleri gelir, özel gelmez', basliklar.includes('A Kaş herkese açık') && basliklar.includes('A takipçilere') && !basliklar.includes('A özel'), basliklar);
bekle('Yeniden eskiye sıralı', JSON.stringify(basliklar) === JSON.stringify(['B gruplara', 'A takipçilere', 'A Kaş herkese açık']), basliklar);
const kart = r.rows[0].j.find((x) => x.id === aKas);
bekle('Kartta sadeleştirilmiş 2B iz var', Array.isArray(kart.track) && kart.track.length >= 2 && kart.track[0].length === 2, kart.track?.slice(0, 2));
bekle('Başkasının izinde baş/son 200 m kırpılmış (ilk nokta başlangıç değil)', kart.track[0][0] !== 29.6, kart.track[0]);
bekle('Mola sayısı 1', kart.stop_count === 1, kart.stop_count);
bekle('mine=false, liked=false', kart.mine === false && kart.liked === false, kart);

console.log('\nBeğeni');
await olarak(B, `insert into activity_likes (activity_id, user_id) values ($1, $2)`, [aKas, B]);
r = await olarak(B, `select akis('takip') as j`);
const k2 = r.rows[0].j.find((x) => x.id === aKas);
bekle('Beğeni sayısı 1 ve liked=true', k2.like_count === 1 && k2.liked === true, k2);
let izinsiz = null;
try {
  await olarak(B, `insert into activity_likes (activity_id, user_id) values ($1, $2)`, [aOzel, B]);
} catch (e) {
  izinsiz = e.message;
}
bekle('Görmediği aktiviteyi beğenemez', !!izinsiz, izinsiz);

console.log('\nSayfalama');
r = await olarak(B, `select akis('takip', null, null, null, null, 2) as j`);
const s1 = r.rows[0].j;
r = await olarak(B, `select akis('takip', $1::timestamptz, $2::uuid, null, null, 2) as j`, [s1.at(-1).started_at, s1.at(-1).id]);
const s2 = r.rows[0].j;
bekle('2 + 1, tekrar yok', s1.length === 2 && s2.length === 1 && !s1.some((x) => x.id === s2[0].id), [s1.map((x) => x.title), s2.map((x) => x.title)]);

console.log('\nAkış: gruplar');
const grup = (await olarak(A, `select grup_olustur('{"name":"Kaş Bisiklet"}'::jsonb) as id`)).rows[0].id;
r = await olarak(A, `select akis('gruplar') as j`);
bekle('Ortak grup yokken boş', r.rows[0].j.length === 0, r.rows[0].j);
const kod = (await olarak(A, `select grup_detay($1) ->> 'invite_code' as code`, [grup])).rows[0]?.code;
await olarak(B, `select davetle_katil($1)`, [kod]);
r = await olarak(A, `select akis('gruplar') as j`);
bekle('B gruba katılınca A, B\'nin "gruplar" aktivitesini görür', r.rows[0].j.length === 1 && r.rows[0].j[0].id === bGrup, r.rows[0].j.map((x) => x.title));
r = await olarak(C, `select akis('gruplar') as j`);
bekle('Grupta olmayan C görmez', r.rows[0].j.length === 0, r.rows[0].j);

console.log('\nAkış: yakınımda');
r = await olarak(C, `select akis('yakin', null, null, 29.61, 36.21) as j`);
bekle('C Kaş\'tayken A\'nın açık Kaş aktivitesi gelir, takipçi/özel gelmez', r.rows[0].j.length === 1 && r.rows[0].j[0].id === aKas, r.rows[0].j.map((x) => x.title));
r = await olarak(C, `select akis('yakin', null, null, 32.8, 39.9) as j`);
bekle('Ankara\'dan bakınca boş', r.rows[0].j.length === 0, r.rows[0].j.map((x) => x.title));
let konumsuz = null;
try {
  await olarak(C, `select akis('yakin')`);
} catch (e) {
  konumsuz = e.message;
}
bekle('Konumsuz "yakın" hata verir', /konum/.test(konumsuz ?? ''), konumsuz);

console.log('\nKişi sayfası ve arama');
r = await olarak(C, `select kisi_profili($1) as j`, [A]);
let kp = r.rows[0].j;
bekle('C, A\'yı görünce: 1 takipçi, takip etmiyor, yalnızca açık aktivite sayılır', kp.follower_count === 1 && kp.i_follow === false && kp.activity_count === 1 && kp.temporary === false, kp);
r = await olarak(B, `select kisi_profili($1) as j`, [A]);
kp = r.rows[0].j;
bekle('B için: takip ediyor, ortak grup var, 2 aktivite görünür', kp.i_follow === true && kp.common_group === true && kp.activity_count === 2, kp);
r = await olarak(A, `select kisi_ara(null) as j`);
bekle('A\'ya öneri: kendisini takip eden ve gruptaki B', r.rows[0].j.length === 1 && r.rows[0].j[0].id === B && r.rows[0].j[0].follows_me === true, r.rows[0].j);
r = await olarak(C, `select kisi_ara('ayşe') as j`);
bekle('"ayşe" araması A\'yı bulur', r.rows[0].j.length === 1 && r.rows[0].j[0].id === A, r.rows[0].j);
r = await olarak(C, `select kisi_ara('yeni') as j`);
bekle('Geçici hesap ("Yeni kullanıcı") aramada çıkmaz', r.rows[0].j.length === 0, r.rows[0].j);
r = await olarak(C, `select kisi_ara('%') as j`);
bekle('"%" joker değil, düz metin', r.rows[0].j.length === 0, r.rows[0].j);
r = await olarak(C, `select takip_listesi($1, 'takipci') as j`, [A]);
bekle('A\'nın takipçileri: B', r.rows[0].j.length === 1 && r.rows[0].j[0].id === B, r.rows[0].j);
r = await olarak(B, `select takip_listesi($1, 'takip') as j`, [B]);
bekle('B\'nin takip ettikleri: A', r.rows[0].j.length === 1 && r.rows[0].j[0].id === A, r.rows[0].j);

console.log('\nTakip kuralları');
let baskasi = null;
try {
  await olarak(C, `insert into follows (follower_id, followee_id) values ($1, $2)`, [B, C]);
} catch (e) {
  baskasi = e.message;
}
bekle('Başkası adına takip eklenemez', !!baskasi, baskasi);
await olarak(B, `delete from follows where follower_id = $1 and followee_id = $2`, [B, A]);
r = await olarak(B, `select akis('takip') as j`);
bekle('Takibi bırakınca A\'nın aktiviteleri gider', r.rows[0].j.every((x) => x.owner_id !== A), r.rows[0].j.map((x) => x.title));

console.log('\nHesap devri');
// Geçici hesap: C'yi takip etsin, A'nın grubuna katılsın, sonra A'ya devredilsin... A zaten grupta; C'ye devredelim
await olarak(G, `insert into follows (follower_id, followee_id) values ($1, $2)`, [G, A], true);
await olarak(A, `insert into follows (follower_id, followee_id) values ($1, $2)`, [A, G]);
await olarak(G, `select davetle_katil($1)`, [kod], true);
const devir = (await olarak(G, `select devir_kodu_al() as k`, [], true)).rows[0].k;
const tasinan = (await olarak(C, `select hesabi_devral($1) as n`, [devir])).rows[0].n;
bekle('1 aktivite taşındı', tasinan === 1, tasinan);
r = await olarak(C, `select kisi_profili($1) as j`, [C]);
kp = r.rows[0].j;
bekle('C artık A\'yı takip ediyor ve A, C\'yi takip ediyor', kp.following_count === 1 && kp.follower_count === 1, kp);
const uye = (await olarak(C, `select grup_uyesi_mi($1) as u`, [grup])).rows[0].u;
bekle('C, geçici hesabın grubuna üye oldu', uye === true, uye);
const kalan = (await db.query(`select (select count(*) from follows where follower_id = '${G}' or followee_id = '${G}')::int as f, (select count(*) from group_members where user_id = '${G}')::int as g`)).rows[0];
bekle('Geçici hesapta takip/üyelik kalmadı', kalan.f === 0 && kalan.g === 0, kalan);

console.log('\nYorumlar');
async function hataMesaji(fn) {
  try {
    await fn();
    return null;
  } catch (e) {
    return e.message;
  }
}
let y = (await olarak(C, `select yorum_yaz($1, $2) as j`, [aKas, '  Harika rota!  '])).rows[0].j;
bekle('C açık aktiviteye yorum yazar; boşluklar kırpılır, adı gelir', y.body === 'Harika rota!' && y.display_name === 'Cem Kaya' && y.mine === true, y);
const yC = y.id;
const yB = (await olarak(B, `select yorum_yaz($1, 'Ben de gitmek istiyorum') as j`, [aKas])).rows[0].j.id;
let m = await hataMesaji(() => olarak(B, `select yorum_yaz($1, 'gizli?')`, [aOzel]));
bekle('Göremediği aktiviteye yorum yazamaz', /göremiyorsun/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(B, `select yorum_yaz($1, '   ')`, [aKas]));
bekle('Boş yorum reddedilir', /boş/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(B, `select yorum_yaz($1, $2)`, [aKas, 'x'.repeat(1001)]));
bekle('1000 karakterden uzun yorum reddedilir', /1000/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(B, `insert into activity_comments (activity_id, user_id, body) values ($1, $2, 'doğrudan')`, [aKas, B]));
bekle('Tabloya doğrudan yorum yazılamaz (sınırlar atlanamaz)', /permission denied/.test(m ?? ''), m);

r = await olarak(A, `select aktivite_yorumlari($1) as j`, [aKas]);
let yl = r.rows[0].j;
bekle('Sahibi için: 2 yorum, eskiden yeniye, silme yetkisi var', yl.comment_count === 2 && yl.i_own_activity === true && yl.comments[0].id === yC && yl.comments[1].id === yB, yl);
r = await olarak(B, `select aktivite_sosyal($1) as j`, [aOzel]);
bekle('Göremediği aktivitenin sayıları gelmez', r.rows[0].j === null, r.rows[0].j);
r = await olarak(C, `select aktivite_sosyal($1) as j`, [aKas]);
bekle('aktivite_sosyal: 1 beğeni (B), 2 yorum, C beğenmedi', r.rows[0].j.like_count === 1 && r.rows[0].j.comment_count === 2 && r.rows[0].j.liked === false, r.rows[0].j);

let silindi = (await olarak(B, `select yorum_sil($1) as s`, [yC])).rows[0].s;
bekle('B, C\'nin yorumunu silemez', silindi === false, silindi);
silindi = (await olarak(A, `select yorum_sil($1) as s`, [yB])).rows[0].s;
bekle('Aktivitenin sahibi A, B\'nin yorumunu siler', silindi === true, silindi);
silindi = (await olarak(C, `select yorum_sil($1) as s`, [yC])).rows[0].s;
bekle('C kendi yorumunu siler', silindi === true, silindi);

for (let i = 0; i < 10; i++) await olarak(C, `select yorum_yaz($1, $2)`, [aKas, `yorum ${i}`]);
m = await hataMesaji(() => olarak(C, `select yorum_yaz($1, 'on birinci')`, [aKas]));
bekle('Dakikada 10 yorumdan sonrası reddedilir', /hızlı/.test(m ?? ''), m);

console.log('\nPaylaşım bağlantısı');
async function anonOlarak(sql, params = []) {
  await db.exec(`set role anon; select set_config('request.jwt.claims', '', false);`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec(`reset role;`);
  }
}
m = await hataMesaji(() => olarak(B, `select paylasim_baglantisi_ac($1)`, [aOzel]));
bekle('Başkasının aktivitesine bağlantı açılamaz', /kendi aktiviten/.test(m ?? ''), m);
const anahtar1 = (await olarak(A, `select paylasim_baglantisi_ac($1) as k`, [aOzel])).rows[0].k;
const anahtar1b = (await olarak(A, `select paylasim_baglantisi_ac($1) as k`, [aOzel])).rows[0].k;
bekle('Sahibi bağlantı açar; 32 karakter, ikinci kez aynısı döner', /^[0-9a-f]{32}$/.test(anahtar1) && anahtar1 === anahtar1b, [anahtar1, anahtar1b]);
r = await anonOlarak(`select paylasilan_aktivite($1) as j`, [anahtar1]);
let pa = r.rows[0].j;
bekle('Giriş yapmamış biri bağlantıyla özel aktiviteyi görür (sahibi bağlantı açtığı için)', pa?.title === 'A özel' && pa.owner_name === 'Ayşe Yılmaz' && pa.distance_m === 2500, pa);
bekle('Kimlikler ve kullanıcı adı verilmez', pa && !('id' in pa) && !('owner_id' in pa) && !('owner_username' in pa), Object.keys(pa ?? {}));
bekle('Başlangıç/bitiş gizli bilgisi gelir', pa.endpoints_hidden === true, pa.endpoints_hidden);
bekle('İz başından kırpılmış (başlangıç noktası görünmez)', Array.isArray(pa.track) && pa.track.length > 1 && pa.track[0][0] !== 29.6, pa.track?.[0]);
bekle('Yükseklik profili var, 2–121 nokta, [mesafe, yükseklik]', Array.isArray(pa.elevation) && pa.elevation.length >= 2 && pa.elevation.length <= 121 && pa.elevation[0].length === 2, pa.elevation?.length);
r = await anonOlarak(`select paylasilan_aktivite($1) as j`, ['0'.repeat(32)]);
bekle('Yanlış anahtar: boş', r.rows[0].j === null, r.rows[0].j);
m = await hataMesaji(() => olarak(B, `select * from aktivite_baglantilari`));
bekle('Anahtar tablosu istemciye kapalı', /permission denied/.test(m ?? ''), m);
r = await olarak(B, `select paylasim_baglantisi($1) as k`, [aOzel]);
bekle('Başkası anahtarı öğrenemez', r.rows[0].k === null, r.rows[0].k);
m = await hataMesaji(() => anonOlarak(`select paylasim_baglantisi_ac($1)`, [aKas]));
bekle('Giriş yapmamış biri bağlantı açamaz', /permission denied/.test(m ?? ''), m);
await olarak(B, `select paylasim_baglantisi_kapat($1)`, [aOzel]);
r = await anonOlarak(`select paylasilan_aktivite($1) as j`, [anahtar1]);
bekle('Başkası bağlantıyı kapatamaz', r.rows[0].j !== null, r.rows[0].j);
await olarak(A, `select paylasim_baglantisi_kapat($1)`, [aOzel]);
r = await anonOlarak(`select paylasilan_aktivite($1) as j`, [anahtar1]);
bekle('Sahibi kapatınca sayfa açılmaz', r.rows[0].j === null, r.rows[0].j);
const anahtar2 = (await olarak(A, `select paylasim_baglantisi_ac($1) as k`, [aOzel])).rows[0].k;
bekle('Yeniden açınca yeni anahtar üretilir', anahtar2 !== anahtar1, [anahtar1, anahtar2]);

console.log('\nBildirimler');
const sayi = async (u) => (await olarak(u, `select bildirim_sayisi() as n`)).rows[0].n;
const liste = async (u) => (await olarak(u, `select bildirimlerim() as j`)).rows[0].j;
await olarak(A, `select bildirimleri_okundu_say()`);
await olarak(B, `select bildirimleri_okundu_say()`);
bekle('Başlangıçta okunmamış yok', (await sayi(A)) === 0, await sayi(A));

await olarak(B, `insert into follows (follower_id, followee_id) values ($1, $2)`, [B, A]);
let bl = await liste(A);
bekle('B takip edince A\'ya "takip" bildirimi (aktör adı ve geri takip bilgisi)', bl[0]?.tur === 'takip' && bl[0].aktor_adi === 'Burak Demir' && bl[0].takip_ediyorum === false && (await sayi(A)) === 1, bl[0]);
await olarak(B, `delete from follows where follower_id = $1 and followee_id = $2`, [B, A]);
bekle('Takibi bırakınca okunmamış bildirim silinir', (await sayi(A)) === 0, await sayi(A));
await olarak(B, `insert into follows (follower_id, followee_id) values ($1, $2)`, [B, A]);
await olarak(B, `delete from follows where follower_id = $1 and followee_id = $2`, [B, A]);
await olarak(B, `insert into follows (follower_id, followee_id) values ($1, $2)`, [B, A]);
bekle('Takip / bırak / takip: tek bildirim', (await sayi(A)) === 1, await sayi(A));

// B, A'yı yeniden takip ettiği için takipçilere açık aktiviteyi görür ve beğenebilir
await olarak(B, `insert into activity_likes (activity_id, user_id) values ($1, $2)`, [aTakip, B]);
await olarak(A, `insert into activity_likes (activity_id, user_id) values ($1, $2)`, [aTakip, A]);
bl = await liste(A);
bekle('B beğenince A\'ya "beğeni" bildirimi; A\'nın kendi beğenisi bildirim olmaz', bl[0].tur === 'begeni' && bl[0].aktivite_adi === 'A takipçilere' && bl.filter((x) => x.tur === 'begeni' && x.activity_id === aTakip).length === 1, bl.slice(0, 3));
await olarak(B, `delete from activity_likes where activity_id = $1 and user_id = $2`, [aTakip, B]);
bekle('Beğeniyi geri alınca okunmamış bildirim silinir', !(await liste(A)).some((x) => x.tur === 'begeni' && x.activity_id === aTakip), (await liste(A)).slice(0, 2));
// Daha önce okunmuş bir beğeni bildirimi varsa aynı beğeni yeniden bildirilmez (tekrar tekrar beğen-bırak gürültü yapmasın)
await olarak(B, `insert into activity_likes (activity_id, user_id) values ($1, $2)`, [aTakip, B]);

await olarak(B, `select yorum_yaz($1, 'Süper bir tur!')`, [aKas]);
bl = await liste(A);
bekle('B yorum yazınca A\'ya "yorum" bildirimi, yorum metniyle', bl[0].tur === 'yorum' && bl[0].yorum === 'Süper bir tur!', bl[0]);
m = await hataMesaji(() => olarak(B, `insert into bildirimler (alici, aktor, tur) values ($1, $2, 'takip')`, [A, B]));
bekle('İstemci bildirim yazamaz', /permission denied/.test(m ?? ''), m);
r = await olarak(B, `select count(*)::int as n from bildirimler where alici = $1`, [A]);
bekle('Başkasının bildirimleri okunamaz', r.rows[0].n === 0, r.rows[0].n);

const acikGrup = (await olarak(A, `select grup_olustur('{"name":"Onaylı Topluluk","is_private":false,"requires_approval":true,"is_community":true}'::jsonb) as id`)).rows[0].id;
await olarak(C, `select gruba_katil($1)`, [acikGrup]);
bl = await liste(A);
bekle('C katılmak isteyince grup sahibi A\'ya "katilim_istegi"', bl[0].tur === 'katilim_istegi' && bl[0].grup_adi === 'Onaylı Topluluk' && bl[0].aktor_adi === 'Cem Kaya', bl[0]);
await olarak(B, `select bildirimleri_okundu_say()`);
await olarak(A, `select istegi_yanitla($1, $2, true)`, [acikGrup, C]);
bl = await liste(C);
bekle('İstek kabul edilince C\'ye "katilim_kabul"', bl[0]?.tur === 'katilim_kabul' && bl[0].grup_adi === 'Onaylı Topluluk', bl[0]);
bekle('Yanıtlanan isteğin okunmamış bildirimi sahipten silinir', !(await liste(A)).some((x) => x.tur === 'katilim_istegi'), (await liste(A)).map((x) => x.tur));

const ileride = new Date(Date.now() + 3 * 86400000).toISOString();
await olarak(A, `select etkinlik_olustur($1::jsonb)`, [JSON.stringify({ title: 'Pazar turu', group_id: grup, starts_at: ileride, activity: 'bike' })]);
const blB = await liste(B);
bekle('Grupta etkinlik: üye B\'ye "etkinlik" bildirimi; oluşturan A\'ya yok', blB[0]?.tur === 'etkinlik' && blB[0].etkinlik_adi === 'Pazar turu' && !(await liste(A)).some((x) => x.tur === 'etkinlik'), blB[0]);

const gecici = (await db.query(`select count(*)::int as n from bildirimler where alici = '${G}' or aktor = '${G}'`)).rows[0].n;
const devralinan = (await db.query(`select count(*)::int as n from bildirimler where tur = 'takip' and alici = '${A}' and aktor = '${C}'`)).rows[0].n;
bekle('Hesap devrinde geçici hesabın bildirimleri asıl hesaba geçti (G\'nin takibi artık C\'den)', gecici === 0 && devralinan === 1, { gecici, devralinan });

const onceA = await sayi(A);
await olarak(A, `select bildirimleri_okundu_say()`);
bekle('Okundu sayınca rozet sıfırlanır', onceA > 0 && (await sayi(A)) === 0, [onceA, await sayi(A)]);
bekle('Okunanlar listede kalır', (await liste(A)).length >= 3 && (await liste(A)).every((x) => x.okundu), (await liste(A)).length);

console.log('\nBirlikte yapılan aktivite');
const D = 'd0000000-0000-0000-0000-00000000000d'; // A'yı tanımayan biri
await db.exec(`insert into auth.users (id, is_anonymous, raw_user_meta_data) values ('${D}', false, '{"full_name":"Deniz Yabancı"}')`);
// aKas ile aynı gün, aynı yerde: C (açık), B (özel), D (açık ama tanıdık değil)
await aktivite(C, 'C de oradaydı', 'public', 29.6005, 36.2, 0);
await aktivite(B, 'B gizli kayıt', 'private', 29.6, 36.2005, 0);
await aktivite(D, 'D yabancı', 'public', 29.6, 36.2, 0);
let on = (await olarak(A, `select birlikte_onerileri($1) as j`, [aKas])).rows[0].j;
bekle('Öneri: aynı saatte aynı yoldan geçen tanıdık C; B\'nin gizli kaydı ve yabancı D önerilmez', on.length === 1 && on[0].user_id === C && on[0].display_name === 'Cem Kaya', on);
on = (await olarak(B, `select birlikte_onerileri($1) as j`, [aKas])).rows[0].j;
bekle('Başkasının aktivitesi için öneri alınamaz', on.length === 0, on);
m = await hataMesaji(() => olarak(A, `select birlikte_ekle($1, $2::uuid[])`, [aKas, [D]]));
bekle('Tanımadığın biri etiketlenemez', /takipleştiğin/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(B, `select birlikte_ekle($1, $2::uuid[])`, [aKas, [C]]));
bekle('Başkasının aktivitesine kişi eklenemez', /kendi aktivitene/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(A, `insert into activity_participants (activity_id, user_id) values ($1, $2)`, [aKas, C]));
bekle('Tabloya doğrudan etiket yazılamaz', /permission denied/.test(m ?? ''), m);
const eklenen = (await olarak(A, `select birlikte_ekle($1, $2::uuid[]) as n`, [aKas, [C, B, A]])).rows[0].n;
bekle('A, C ve B\'yi etiketler (kendini saymaz)', eklenen === 2, eklenen);
r = await olarak(C, `select birlikte_kisiler($1) as j`, [aKas]);
bekle('Birlikte yapılanlar listesi: Burak ve Cem', r.rows[0].j.map((x) => x.display_name).join(',') === 'Burak Demir,Cem Kaya', r.rows[0].j);
bl = await liste(C);
bekle('Etiketlenen C\'ye "birlikte" bildirimi', bl[0]?.tur === 'birlikte' && bl[0].aktor_adi === 'Ayşe Yılmaz' && bl[0].activity_id === aKas, bl[0]);
on = (await olarak(A, `select birlikte_onerileri($1) as j`, [aKas])).rows[0].j;
bekle('Etiketlenen kişi artık önerilmez', on.length === 0, on);
r = await olarak(B, `select akis('takip') as j`);
let kartK = r.rows[0].j.find((x) => x.id === aKas);
bekle('Akış kartında birlikte yapılanlar ve "beni etiketledi"', kartK?.with_count === 2 && kartK.with.length === 2 && kartK.tagged_me === true, kartK);

await olarak(A, `select birlikte_ekle($1, $2::uuid[])`, [aOzel, [C]]);
r = await olarak(C, `select akis('takip') as j`);
bekle('Özel aktiviteye etiketlenen C onu görür ve akışında çıkar', r.rows[0].j.some((x) => x.id === aOzel), r.rows[0].j.map((x) => x.title));
let cikti = (await olarak(B, `select birlikte_cikar($1, $2) as s`, [aKas, C])).rows[0].s;
bekle('B, C\'nin etiketini kaldıramaz', cikti === false, cikti);
cikti = (await olarak(C, `select birlikte_cikar($1, $2) as s`, [aOzel, C])).rows[0].s;
r = await olarak(C, `select akis('takip') as j`);
bekle('C kendi etiketini kaldırır; özel aktivite artık görünmez', cikti === true && !r.rows[0].j.some((x) => x.id === aOzel), r.rows[0].j.map((x) => x.title));
cikti = (await olarak(A, `select birlikte_cikar($1, $2) as s`, [aKas, B])).rows[0].s;
r = await olarak(A, `select birlikte_kisiler($1) as j`, [aKas]);
bekle('Sahibi A, B\'nin etiketini kaldırır', cikti === true && r.rows[0].j.length === 1, r.rows[0].j);

console.log('\nKeşfet');
async function rota(uid, ad, gorunurluk, lng0, lat0) {
  const pts = iz(lng0, lat0, 30).map((p) => ({ lng: p.lng, lat: p.lat, alt: p.alt }));
  const p = { name: ad, activity: 'bike', distance_m: 1500, elevation_gain_m: 30, elevation_loss_m: 0, visibility: gorunurluk, points: pts };
  return (await olarak(uid, `select kaydet_rota($1::jsonb) as id`, [JSON.stringify(p)])).rows[0].id;
}
await rota(A, 'Belgrad Ormanı turu', 'public', 28.98, 41.17);
await rota(A, 'A gizli rota', 'private', 29.6, 36.2);
await rota(A, 'Kaş sahil rotası', 'public', 29.62, 36.2);
await rota(D, 'D Kaş tepe rotası', 'public', 29.64, 36.21);
const KAS = [29.61, 36.2];
let kr = (await olarak(C, `select kesfet_rotalar(null, $1, $2) as j`, KAS)).rows[0].j;
bekle('Rotalar: herkese açıklar yakından uzağa (özel rota yok), uzaklık var', kr.length === 3 && kr[2].name === 'Belgrad Ormanı turu' && !kr.some((x) => x.name === 'A gizli rota') && kr[0].uzaklik_m < kr[2].uzaklik_m && Array.isArray(kr[0].preview), kr.map((x) => [x.name, x.uzaklik_m]));
kr = (await olarak(A, `select kesfet_rotalar(null, $1, $2) as j`, KAS)).rows[0].j;
bekle('Kendi rotaların Keşfet\'te çıkmaz', kr.length === 1 && kr[0].name === 'D Kaş tepe rotası', kr.map((x) => x.name));
kr = (await olarak(C, `select kesfet_rotalar('BELGRAD') as j`)).rows[0].j;
bekle('Rota araması (büyük/küçük harf duyarsız)', kr.length === 1 && kr[0].name === 'Belgrad Ormanı turu' && kr[0].uzaklik_m === null, kr.map((x) => x.name));
kr = (await olarak(C, `select kesfet_rotalar() as j`)).rows[0].j;
bekle('Konumsuz: en yeni rota başta', kr[0].name === 'D Kaş tepe rotası', kr.map((x) => x.name));

const ilerideD = new Date(Date.now() + 5 * 86400000).toISOString();
await olarak(D, `select etkinlik_olustur($1::jsonb)`, [JSON.stringify({ title: 'Kaş gün batımı sürüşü', starts_at: ilerideD, activity: 'bike', visibility: 'public', meeting_lng: 29.615, meeting_lat: 36.2, meeting_point_name: 'Kaş meydan' })]);
await olarak(D, `select etkinlik_olustur($1::jsonb)`, [JSON.stringify({ title: 'Çok uzak tarih', starts_at: new Date(Date.now() + 60 * 86400000).toISOString(), activity: 'bike', visibility: 'public' })]);
let ke = (await olarak(B, `select kesfet_etkinlikler(null, $1, $2) as j`, KAS)).rows[0].j;
bekle('Etkinlikler: grubundaki "Pazar turu" + herkese açık olan; 30 günden uzak olan yok; yakındaki başta', ke.length === 2 && ke[0].title === 'Kaş gün batımı sürüşü' && ke[0].uzaklik_m < 1000 && ke[1].title === 'Pazar turu', ke.map((x) => [x.title, x.uzaklik_m]));
ke = (await olarak(D, `select kesfet_etkinlikler() as j`)).rows[0].j;
bekle('Grupta olmayan D grup etkinliğini görmez', ke.length === 1 && ke[0].title === 'Kaş gün batımı sürüşü', ke.map((x) => x.title));
ke = (await olarak(B, `select kesfet_etkinlikler('meydan') as j`)).rows[0].j;
bekle('Etkinlik araması buluşma yerinde de arar', ke.length === 1 && ke[0].title === 'Kaş gün batımı sürüşü', ke.map((x) => x.title));

console.log('\nYönetim paneli ve şikayetler');
await db.exec(`update auth.users set email = 'ayse@ornek.test' where id = '${A}'`);
m = await hataMesaji(() => olarak(A, `select yonetim_ozet()`));
bekle('Yönetici olmayan panel verisini alamaz', /Yönetim yetkisi yok/.test(m ?? ''), m);
await db.exec(`update profiles set is_admin = true where id in ('${A}', '${G}')`);
let oz = (await olarak(A, `select yonetim_ozet() as j`)).rows[0].j;
bekle('Yönetici A genel bakışı görür (4 kalıcı, 1 geçici hesap; 14 günlük seri)', oz.kullanici === 4 && oz.gecici === 1 && oz.gunluk.length === 14 && oz.aktivite > 0, { kullanici: oz.kullanici, gecici: oz.gecici, gun: oz.gunluk.length });
m = await hataMesaji(() => olarak(G, `select yonetim_ozet()`, [], true));
bekle('Geçici hesap is_admin olsa da yönetici sayılmaz', /Yönetim yetkisi yok/.test(m ?? ''), m);
let yk = (await olarak(A, `select yonetim_kullanicilar('ayse@') as j`)).rows[0].j;
bekle('Kullanıcı araması e-postada da arar; yönetici e-postayı görür', yk.toplam === 1 && yk.satirlar[0].email === 'ayse@ornek.test' && yk.satirlar[0].is_admin === true, yk);
yk = (await olarak(A, `select yonetim_kullanicilar() as j`)).rows[0].j;
bekle('Varsayılan liste geçici hesapları göstermez', yk.toplam === 4, yk.toplam);

m = await hataMesaji(() => olarak(C, `select sikayet_et('activity', $1, 'x')`, [aKas]));
bekle('Çok kısa şikayet nedeni reddedilir', /3–500/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(C, `select sikayet_et('activity', $1, 'Uygunsuz içerik')`, ['00000000-0000-0000-0000-000000000000']));
bekle('Olmayan içerik şikayet edilemez', /bulunamadı/.test(m ?? ''), m);
const sk1 = (await olarak(C, `select sikayet_et('activity', $1, 'Uygunsuz içerik') as id`, [aKas])).rows[0].id;
const sk2 = (await olarak(C, `select sikayet_et('activity', $1, 'Yine aynı') as id`, [aKas])).rows[0].id;
bekle('Aynı hedefe açık şikayet tek', sk1 === sk2, [sk1, sk2]);
m = await hataMesaji(() => olarak(C, `select * from reports`));
bekle('Şikayet tablosu istemciye kapalı', /permission denied/.test(m ?? ''), m);
let ys = (await olarak(A, `select yonetim_sikayetler('acik') as j`)).rows[0].j;
bekle('Yönetici açık şikayeti hedef özetiyle görür', ys.toplam === 1 && ys.satirlar[0].hedef.ad === 'A Kaş herkese açık' && ys.satirlar[0].bildiren === 'Cem Kaya', ys.satirlar[0]);
await olarak(A, `select yonetim_sikayet_guncelle($1, 'resolved', 'İncelendi, sorun yok')`, [sk1]);
ys = (await olarak(A, `select yonetim_sikayetler('kapali') as j`)).rows[0].j;
bekle('Şikayet kapatılınca kapalılar listesinde, notuyla', ys.toplam === 1 && ys.satirlar[0].admin_note === 'İncelendi, sorun yok' && (await olarak(A, `select yonetim_sikayetler('acik') as j`)).rows[0].j.toplam === 0, ys.satirlar[0]);

const dRota = (await db.query(`select id from routes where name = 'D Kaş tepe rotası'`)).rows[0].id;
await olarak(A, `select yonetim_rota_gizle($1)`, [dRota]);
kr = (await olarak(C, `select kesfet_rotalar() as j`)).rows[0].j;
bekle('Yönetici rotayı herkese kapatınca Keşfet\'ten düşer', !kr.some((x) => x.id === dRota), kr.map((x) => x.name));
const dAkt = (await db.query(`select id from activities where title = 'D yabancı'`)).rows[0].id;
m = await hataMesaji(() => olarak(B, `select yonetim_aktivite_sil($1)`, [dAkt]));
bekle('Yönetici olmayan aktivite silemez', /Yönetim yetkisi yok/.test(m ?? ''), m);
await olarak(A, `select yonetim_aktivite_sil($1)`, [dAkt]);
bekle('Yönetici aktiviteyi siler', (await db.query(`select count(*)::int as n from activities where id = '${dAkt}'`)).rows[0].n === 0, null);
m = await hataMesaji(() => olarak(A, `select yonetim_yetki($1, false)`, [A]));
bekle('Kendi yönetici yetkini alamazsın', /alamazsın/.test(m ?? ''), m);
await olarak(A, `select yonetim_yetki($1, true)`, [B]);
oz = (await olarak(B, `select yonetim_ozet() as j`)).rows[0].j;
bekle('A, B\'ye yetki verince B paneli görür', oz.kullanici === 4, oz.kullanici);
m = await hataMesaji(() => anonOlarak(`select yonetim_ozet()`));
bekle('Giriş yapmamış biri panel fonksiyonlarını çağıramaz', /permission denied/.test(m ?? ''), m);
const kotuYorum = (await db.query(`insert into activity_comments (activity_id, user_id, body) values ($1, $2, 'Kaba bir yorum') returning id`, [aKas, C])).rows[0].id;
m = await hataMesaji(() => olarak(D, `select yonetim_yorum_sil($1)`, [kotuYorum]));
bekle('Yönetici olmayan yorum kaldıramaz', /Yönetim yetkisi yok/.test(m ?? ''), m);
await olarak(A, `select yonetim_yorum_sil($1)`, [kotuYorum]);
bekle('Yönetici şikayet edilen yorumu kaldırır', (await db.query(`select count(*)::int n from activity_comments where id = '${kotuYorum}'`)).rows[0].n === 0, null);
const kotuMesaj = (await db.query(`insert into messages (group_id, sender_id, body) values ($1, $2, 'Spam bağlantı') returning id`, [grup, B])).rows[0].id;
await olarak(A, `select yonetim_mesaj_sil($1)`, [kotuMesaj]);
bekle('Yönetici grup mesajını kaldırır', (await db.query(`select count(*)::int n from messages where id = '${kotuMesaj}'`)).rows[0].n === 0, null);
m = await hataMesaji(() => olarak(A, `select yonetim_mesaj_sil($1)`, [kotuMesaj]));
bekle('Olmayan mesaj için açık hata', /bulunamadı/.test(m ?? ''), m);

await db.query(`insert into push_jetonlari (jeton, user_id, platform) values ('ExponentPushToken[engelDenemesi12]', $1, 'ios')`, [C]);
await olarak(A, `select yonetim_engelle($1, true)`, [C]);
r = await db.query(`select banned_until > now() + interval '50 years' as e from auth.users where id = '${C}'`);
bekle('Yönetici kullanıcıyı engeller (Auth girişi ve yenilemeyi kapatır)', r.rows[0].e === true, r.rows[0]);
bekle('Engellenenin telefon bildirim jetonları silinir', (await db.query(`select count(*)::int n from push_jetonlari where user_id = '${C}'`)).rows[0].n === 0, null);
yk = (await olarak(A, `select yonetim_kullanicilar('cem') as j`)).rows[0].j;
bekle('Kullanıcı listesinde engelli görünür', yk.satirlar[0]?.engelli === true, yk.satirlar[0]);
m = await hataMesaji(() => olarak(A, `select yonetim_engelle($1, true)`, [A]));
bekle('Kendini engelleyemezsin', /Kendini/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(A, `select yonetim_engelle($1, true)`, [B]));
bekle('Yönetici engellenmeden önce yetkisi alınmalı', /yetkisini al/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(D, `select yonetim_engelle($1, true)`, [A]));
bekle('Yönetici olmayan kimseyi engelleyemez', /Yönetim yetkisi yok/.test(m ?? ''), m);
await olarak(A, `select yonetim_engelle($1, false)`, [C]);
r = await db.query(`select banned_until from auth.users where id = '${C}'`);
bekle('Engel kaldırılır', r.rows[0].banned_until === null, r.rows[0]);

console.log('\nHava durumu');
const hava = { t: '2026-11-11T06:00:00Z', sicaklik: 14.2, hissedilen: 13.1, ruzgar: 3.9, ruzgarYon: 271, nem: 62, yagis: 0, uv: 0.4, sembol: 'partlycloudy_day', kaynak: 'met.no' };
await olarak(A, `update activities set weather = $1::jsonb where id = $2`, [JSON.stringify(hava), aKas]);
r = await olarak(B, `select weather from aktivite_ozetleri where id = $1`, [aKas]);
bekle('Sahibi hava bilgisini yazar; aktiviteyi gören özet görünümünde okur', r.rows[0]?.weather?.sicaklik === 14.2 && r.rows[0].weather.sembol === 'partlycloudy_day', r.rows[0]);
r = await olarak(B, `select akis('takip') as j`);
bekle('Akış kartında hava bilgisi', r.rows[0].j.find((x) => x.id === aKas)?.weather?.ruzgarYon === 271, r.rows[0].j.find((x) => x.id === aKas)?.weather);
m = await hataMesaji(() => olarak(A, `update activities set weather = '[1,2]'::jsonb where id = $1`, [aKas]));
bekle('Nesne olmayan hava bilgisi reddedilir', /hava_bicimi/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(A, `update activities set weather = $1::jsonb where id = $2`, [JSON.stringify({ ...hava, lat: 36.2, lng: 29.6 }), aKas]));
bekle('Konum içeren hava bilgisi reddedilir', /hava_bicimi/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(A, `update activities set weather = $1::jsonb where id = $2`, [JSON.stringify({ ...hava, not: 'x'.repeat(3000) }), aKas]));
bekle('Çok büyük hava bilgisi reddedilir', /hava_bicimi/.test(m ?? ''), m);
await olarak(C, `update activities set weather = '{"sicaklik": 99, "ruzgar": 0}'::jsonb where id = $1`, [aKas]);
r = await db.query(`select weather ->> 'sicaklik' as s from activities where id = '${aKas}'`);
bekle('Başkası hava bilgisini değiştiremez', r.rows[0].s === '14.2', r.rows[0]);

console.log('\nTelefona bildirim (push)');
const JETON_A = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaa]';
m = await hataMesaji(() => olarak(A, `select push_jetonu_kaydet('sahte-jeton', 'ios')`));
bekle('Geçersiz jeton reddedilir', /Geçersiz bildirim jetonu/.test(m ?? ''), m);
await olarak(A, `select push_jetonu_kaydet($1, 'ios')`, [JETON_A]);
m = await hataMesaji(() => olarak(C, `select * from push_jetonlari`));
bekle('Jeton tablosu istemciye kapalı', /permission denied/.test(m ?? ''), m);
// pg_net yokken (PGlite'ta yok) bildirim yine yazılır
const onceSayi = (await db.query(`select count(*)::int as n from bildirimler where alici = '${A}'`)).rows[0].n;
await olarak(B, `select yorum_yaz($1, 'pg_net yokken yorum')`, [aKas]);
bekle('pg_net yokken uygulama içi bildirim yine yazılır', (await db.query(`select count(*)::int as n from bildirimler where alici = '${A}'`)).rows[0].n === onceSayi + 1, null);
// pg_net'i taklit et: çağrıları tabloya yaz
await db.exec(`
  create schema if not exists net;
  create table net.cagri (url text, body jsonb, headers jsonb);
  create function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb, timeout_milliseconds integer default 5000)
  returns bigint language sql as $$ insert into net.cagri values (url, body, headers) returning 1::bigint $$;
`);
await olarak(B, `select yorum_yaz($1, 'Push ile gelen yorum')`, [aKas]);
let cagri = (await db.query(`select * from net.cagri`)).rows;
const mesaj = cagri[0]?.body?.[0];
bekle('Yorum bildirimi Expo Push Service\'e gider (alıcının jetonu, Türkçe metin, rozet sayısı)', cagri.length === 1 && cagri[0].url === 'https://exp.host/--/api/v2/push/send' && mesaj?.to === JETON_A && mesaj.title === 'Burak Demir' && mesaj.body === 'Yorum yaptı: “Push ile gelen yorum”' && mesaj.data?.tur === 'yorum' && mesaj.data?.activity_id === aKas && mesaj.badge >= 1, cagri);
await olarak(B, `select yorum_yaz($1, 'jetonsuz kişiye')`, [(await db.query(`select id from activities where title = 'C de oradaydı'`)).rows[0].id]);
bekle('Jetonu olmayan alıcıya (C) istek gitmez, bildirim yine yazılır', (await db.query(`select count(*)::int as n from net.cagri`)).rows[0].n === 1 && (await db.query(`select count(*)::int as n from bildirimler where alici = '${C}' and tur = 'yorum'`)).rows[0].n >= 1, null);
const icerik = (await db.query(`select push_icerigi(b) as j from bildirimler b where tur = 'etkinlik' and alici = '${B}' limit 1`)).rows[0]?.j;
bekle('Etkinlik bildiriminin metni (başlık grup adı)', icerik?.title === 'Kaş Bisiklet' && icerik.body === 'Ayşe Yılmaz etkinlik oluşturdu: “Pazar turu”', icerik);
await olarak(C, `select push_jetonu_kaydet($1, 'android')`, [JETON_A]);
r = await db.query(`select user_id, platform from push_jetonlari where jeton = '${JETON_A}'`);
bekle('Aynı cihaz başka hesaba geçince jeton yeni hesaba taşınır', r.rows[0].user_id === C && r.rows[0].platform === 'android', r.rows[0]);
await olarak(A, `select push_jetonu_sil($1)`, [JETON_A]);
bekle('Başkasının jetonu silinemez', (await db.query(`select count(*)::int as n from push_jetonlari where jeton = '${JETON_A}'`)).rows[0].n === 1, null);
await olarak(C, `select push_jetonu_sil($1)`, [JETON_A]);
bekle('Sahibi jetonunu siler (bildirimleri kapatınca)', (await db.query(`select count(*)::int as n from push_jetonlari`)).rows[0].n === 0, null);
await db.exec(`drop schema net cascade`);

console.log('\nGeçersiz jeton temizliği ve paylaşımda hava');
await db.exec(`
  create schema if not exists net;
  delete from push_istekleri;
  create sequence net.istek_sira;
  create table net.cagri (id bigint, url text, body jsonb);
  create table net._http_response (id bigint primary key, status_code integer, content text, created timestamptz default now());
  create function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb, timeout_milliseconds integer default 5000)
  returns bigint language sql as $$ insert into net.cagri values (nextval('net.istek_sira'), url, body) returning id $$;
`);
const J1 = 'ExponentPushToken[eskiTelefon000000001]';
const J2 = 'ExponentPushToken[yeniTelefon000000002]';
await olarak(A, `select push_jetonu_kaydet($1, 'ios')`, [J1]);
await olarak(A, `select push_jetonu_kaydet($1, 'android')`, [J2]);
await olarak(D, `select yorum_yaz($1, 'İlk push')`, [aKas]);
let ist = (await db.query(`select istek, jetonlar from push_istekleri`)).rows;
const gid = (await db.query(`select id, body from net.cagri`)).rows;
bekle('Gönderilen isteğin jetonları sırasıyla kaydedilir', ist.length === 1 && ist[0].istek == gid[0].id && JSON.stringify(ist[0].jetonlar) === JSON.stringify(gid[0].body.map((x) => x.to)) && ist[0].jetonlar.length === 2, { ist, gid });
const olu = ist[0].jetonlar[1];
const canli = ist[0].jetonlar[0];
await db.query(`insert into net._http_response (id, status_code, content) values ($1, 200, $2)`, [ist[0].istek, JSON.stringify({ data: [{ status: 'ok', id: 'x1' }, { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } }] })]);
await olarak(D, `select yorum_yaz($1, 'İkinci push')`, [aKas]);
r = await db.query(`select jeton from push_jetonlari where user_id = '${A}' order by jeton`);
bekle('Sonraki bildirimde "DeviceNotRegistered" dönen jeton silinir, çalışan kalır', r.rows.length === 1 && r.rows[0].jeton === canli && canli !== olu, r.rows);
const son = (await db.query(`select body from net.cagri order by id desc limit 1`)).rows[0].body;
bekle('İkinci bildirim yalnızca çalışan jetona gider', son.length === 1 && son[0].to === canli, son);
ist = (await db.query(`select istek from push_istekleri`)).rows;
bekle('İşlenen yanıtın kaydı silinir, yenisi bekler', ist.length === 1 && ist[0].istek != gid[0].id, ist);
await db.query(`insert into net._http_response (id, status_code, content) values ($1, 500, 'sunucu hatası')`, [ist[0].istek]);
bekle('Hatalı yanıtta jeton silinmez', (await db.query(`select push_yanitlarini_isle() as n`)).rows[0].n === 0 && (await db.query(`select count(*)::int n from push_jetonlari where user_id = '${A}'`)).rows[0].n === 1, null);
m = await hataMesaji(() => olarak(A, `select push_yanitlarini_isle()`));
bekle('Temizlik fonksiyonu istemciye kapalı', /permission denied/.test(m ?? ''), m);
await db.exec(`drop schema net cascade; delete from push_jetonlari;`);

const anahtarKas = (await olarak(A, `select paylasim_baglantisi_ac($1) as k`, [aKas])).rows[0].k;
const pk = (await anonOlarak(`select paylasilan_aktivite($1) as j`, [anahtarKas])).rows[0].j;
bekle('Paylaşım sayfası kayıt başındaki havayı da alır', pk?.weather?.sicaklik === 14.2 && pk.weather.sembol === 'partlycloudy_day', pk?.weather);
await olarak(A, `select paylasim_baglantisi_kapat($1)`, [aKas]);

console.log('\nProfil ve güvenlik');
m = await hataMesaji(() => olarak(D, `update profiles set is_admin = true where id = $1`, [D]));
bekle('GÜVENLİK: kullanıcı kendini yönetici yapamaz (is_admin güncellenemez)', /permission denied/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(D, `select yonetim_ozet()`));
bekle('…ve panel verisini alamaz', /Yönetim yetkisi yok/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(D, `update profiles set username = 'deniz' where id = $1`, [D]));
bekle('Kullanıcı adı doğrudan değiştirilemez (yalnızca denetimli fonksiyonla)', /permission denied/.test(m ?? ''), m);
await olarak(D, `update profiles set display_name = 'Deniz Y.' where id = $1`, [D]);
bekle('Ad doğrudan güncellenebilir (ilk girişte Google/Apple adı için)', (await db.query(`select display_name from profiles where id = '${D}'`)).rows[0].display_name === 'Deniz Y.', null);
m = await hataMesaji(() => olarak(D, `select profil_guncelle($1::jsonb)`, [JSON.stringify({ display_name: 'Deniz', username: 'admin' })]));
bekle('Ayrılmış kullanıcı adı reddedilir', /kullanılamaz/.test(m ?? ''), m);
await db.exec(`update profiles set username = 'ayse' where id = '${A}'`);
const ayseKadi = 'ayse';
m = await hataMesaji(() => olarak(D, `select profil_guncelle($1::jsonb)`, [JSON.stringify({ display_name: 'Deniz', username: ayseKadi })]));
bekle('Alınmış kullanıcı adı reddedilir', /alınmış/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(D, `select profil_guncelle($1::jsonb)`, [JSON.stringify({ display_name: 'Deniz', username: 'Deniz Yılmaz' })]));
bekle('Geçersiz karakterli kullanıcı adı reddedilir', /küçük harf/.test(m ?? ''), m);
r = await olarak(D, `select kullanici_adi_musait('deniz.dag') as a, kullanici_adi_musait($1) as b`, [ayseKadi]);
bekle('Kullanıcı adı uygunluk denetimi', r.rows[0].a === true && r.rows[0].b === false, r.rows[0]);
r = await olarak(D, `select profil_guncelle($1::jsonb) as j`, [JSON.stringify({ display_name: ' Deniz Dağ ', username: 'Deniz.Dag', city: 'Fethiye', bio: 'Patika koşucusu' })]);
bekle('Profil güncellenir (kırpılır, kullanıcı adı küçük harfe çevrilir)', r.rows[0].j.username === 'deniz.dag' && r.rows[0].j.display_name === 'Deniz Dağ' && r.rows[0].j.city === 'Fethiye', r.rows[0].j);
r = await anonOlarak(`select herkese_acik_profil('ayse') as j`);
const hp = r.rows[0].j;
bekle('Web profili: yalnızca herkese açık aktiviteler, iz yok', hp?.display_name === 'Ayşe Yılmaz' && hp.aktiviteler.length === hp.aktivite_sayisi && hp.aktiviteler.every((x) => !('track' in x)) && !hp.aktiviteler.some((x) => x.title === 'A özel' || x.title === 'A takipçilere'), hp);
r = await anonOlarak(`select herkese_acik_profil((select username from profiles where id = '${G}')) as j`);
bekle('Geçici hesabın web profili yok', r.rows[0].j === null, r.rows[0].j);
await olarak(A, `update activities set title = 'Kaş sahil turu' where id = $1`, [aKas]);
await olarak(C, `update activities set title = 'Ele geçirildi' where id = $1`, [aKas]);
bekle('Sahibi aktiviteyi yeniden adlandırır; başkası adlandıramaz', (await db.query(`select title from activities where id = '${aKas}'`)).rows[0].title === 'Kaş sahil turu', null);
m = await hataMesaji(() => olarak(A, `update activities set title = $1 where id = $2`, ['x'.repeat(81), aKas]));
bekle('80 karakterden uzun başlık reddedilir', /aktivite_baslik_uzunlugu/.test(m ?? ''), m);
await db.exec(`update activities set title = 'A Kaş herkese açık' where id = '${aKas}'`);

console.log('\nFotoğraflar');
const u1 = '11111111-2222-3333-4444-555555555555';
const u2 = '66666666-7777-8888-9999-aaaaaaaaaaaa';
r = await db.query(`select id, public from storage.buckets where id in ('mola', 'profil') order by id`);
bekle('Kovalar: mola gizli, profil herkese açık', JSON.stringify(r.rows) === JSON.stringify([{ id: 'mola', public: false }, { id: 'profil', public: true }]), r.rows);
await olarak(A, `insert into storage.objects (bucket_id, name) values ('profil', $1)`, [`${A}/${u1}.jpg`]);
m = await hataMesaji(() => olarak(A, `insert into storage.objects (bucket_id, name) values ('profil', $1)`, [`${B}/${u1}.jpg`]));
bekle('Başkasının klasörüne profil fotoğrafı yüklenemez', /row-level security/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(A, `insert into storage.objects (bucket_id, name) values ('profil', $1)`, [`${A}/alt/${u2}.jpg`]));
bekle('Profil fotoğrafı yolu biçim dışıysa yüklenemez', /row-level security/.test(m ?? ''), m);
await olarak(B, `delete from storage.objects where bucket_id = 'profil' and name = $1`, [`${A}/${u1}.jpg`]);
bekle('Başkasının profil fotoğrafı silinemez', (await db.query(`select count(*)::int n from storage.objects where bucket_id = 'profil'`)).rows[0].n === 1, null);
await olarak(A, `update profiles set avatar_url = $1 where id = $2`, [`https://api.ornek/storage/v1/object/public/profil/${A}/${u1}.jpg`, A]);
bekle('Profil fotoğrafı adresi kaydedilir', !!(await db.query(`select avatar_url from profiles where id = '${A}'`)).rows[0].avatar_url, null);
m = await hataMesaji(() => olarak(A, `update profiles set avatar_url = 'javascript:alert(1)' where id = $1`, [A]));
bekle('Profil fotoğrafı adresi https olmalı', /profil_foto_adresi/.test(m ?? ''), m);

await olarak(A, `insert into storage.objects (bucket_id, name) values ('mola', $1), ('mola', $2)`, [`${aKas}/${u1}.jpg`, `${aOzel}/${u2}.jpg`]);
m = await hataMesaji(() => olarak(B, `insert into storage.objects (bucket_id, name) values ('mola', $1)`, [`${aKas}/${u2}.jpg`]));
bekle('Başkasının aktivitesine mola fotoğrafı yüklenemez', /row-level security/.test(m ?? ''), m);
r = await olarak(D, `select name from storage.objects where bucket_id = 'mola'`);
bekle('Mola fotoğrafını yalnızca aktiviteyi görebilen okur (herkese açık evet, özel hayır)', r.rows.length === 1 && r.rows[0].name.startsWith(aKas), r.rows);
r = await olarak(A, `select count(*)::int n from storage.objects where bucket_id = 'mola'`);
bekle('Sahibi kendi özel aktivitesinin fotoğrafını görür', r.rows[0].n === 2, r.rows[0]);
const molaKas = (await db.query(`select id from activity_stops where activity_id = '${aKas}' limit 1`)).rows[0].id;
await olarak(A, `update activity_stops set photo_urls = array[$1], note = 'Çeşme başı' where id = $2`, [`${aKas}/${u1}.jpg`, molaKas]);
m = await hataMesaji(() => olarak(A, `update activity_stops set photo_urls = array[$1] where id = $2`, [`${aOzel}/${u2}.jpg`, molaKas]));
bekle('Molaya başka aktivitenin fotoğrafı bağlanamaz', /mola_fotolari/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(A, `update activity_stops set photo_urls = $1 where id = $2`, [Array.from({ length: 7 }, () => `${aKas}/${u1}.jpg`), molaKas]));
bekle('Bir molaya en fazla 6 fotoğraf', /mola_fotolari/.test(m ?? ''), m);
r = await olarak(B, `select aktivite_detay($1) as j`, [aKas]);
const dm = r.rows[0].j.stops[0];
bekle('aktivite_detay molanın kimliğini, notunu ve fotoğraflarını döner', dm.id === molaKas && dm.note === 'Çeşme başı' && dm.photos[0] === `${aKas}/${u1}.jpg`, dm);
await olarak(A, `delete from storage.objects where bucket_id = 'mola' and name = $1`, [`${aOzel}/${u2}.jpg`]);
bekle('Sahibi mola fotoğrafını siler', (await db.query(`select count(*)::int n from storage.objects where bucket_id = 'mola'`)).rows[0].n === 1, null);

console.log('\nYetki');
let anonHata = null;
try {
  await db.exec(`set role anon`);
  await db.query(`select akis('takip')`);
} catch (e) {
  anonHata = e.message;
} finally {
  await db.exec(`reset role`);
}
bekle('anon rolü akis() çağıramaz', /permission denied/.test(anonHata ?? ''), anonHata);

console.log('\nHesap silme ve site ayarları');
const E = 'e0000000-0000-0000-0000-00000000000e';
await db.exec(`insert into auth.users (id, is_anonymous, raw_user_meta_data) values ('${E}', false, '{"full_name":"Ece Silinecek"}')`);
const eGrup = (await olarak(E, `select grup_olustur('{"name":"Ece Kulübü"}'::jsonb) as id`)).rows[0].id;
const eYalniz = (await olarak(E, `select grup_olustur('{"name":"Ece Yalnız"}'::jsonb) as id`)).rows[0].id;
await db.query(`insert into group_members (group_id, user_id, role, joined_at) values ($1, $2, 'member', now() - interval '2 days'), ($1, $3, 'admin', now() - interval '1 day')`, [eGrup, C, B]);
const eAkt = await aktivite(E, 'Ece sabah turu', 'public', 29.6, 36.2, 5);
await db.query(`insert into activity_comments (activity_id, user_id, body) values ($1, $2, 'Ece yorumu')`, [aKas, E]);
await olarak(E, `insert into follows (follower_id, followee_id) values ($1, $2)`, [E, A]);
const eEtk = (await olarak(E, `select etkinlik_olustur($1::jsonb) as id`, [JSON.stringify({ title: 'Ece etkinliği', group_id: eGrup, starts_at: new Date(Date.now() + 86400000 * 3).toISOString(), activity: 'bike' })])).rows[0].id;
m = await hataMesaji(() => anonOlarak(`select hesabimi_sil()`));
bekle('Giriş yapmamış biri hesap silme fonksiyonunu çağıramaz', /permission denied/.test(m ?? ''), m);
await olarak(E, `select hesabimi_sil()`);
const say = async (sql) => (await db.query(sql)).rows[0].n;
bekle('Hesap ve profil silinir', (await say(`select count(*)::int n from auth.users where id = '${E}'`)) === 0 && (await say(`select count(*)::int n from profiles where id = '${E}'`)) === 0, null);
bekle('Aktiviteleri, yorumları ve takipleri silinir', (await say(`select count(*)::int n from activities where id = '${eAkt}'`)) === 0 && (await say(`select count(*)::int n from activity_comments where user_id = '${E}'`)) === 0 && (await say(`select count(*)::int n from follows where follower_id = '${E}'`)) === 0, null);
r = await db.query(`select g.created_by, m.role from groups g join group_members m on m.group_id = g.id and m.user_id = g.created_by where g.id = $1`, [eGrup]);
bekle('Kurduğu grup yöneticiye (B) devredilir; grup ve üyeler kalır', r.rows[0]?.created_by === B && r.rows[0]?.role === 'owner' && (await say(`select count(*)::int n from group_members where group_id = '${eGrup}'`)) === 2, r.rows);
bekle('Başka üyesi olmayan grubu silinir', (await say(`select count(*)::int n from groups where id = '${eYalniz}'`)) === 0, null);
bekle('Oluşturduğu etkinlik silinir', (await say(`select count(*)::int n from events where id = '${eEtk}'`)) === 0, null);
bekle('Başkalarının verisi yerinde (A\'nın aktivitesi, B\'nin profili)', (await say(`select count(*)::int n from activities where id = '${aKas}'`)) === 1 && (await say(`select count(*)::int n from profiles where id = '${B}'`)) === 1, null);

r = await anonOlarak(`select site_ayarlari() as j`);
bekle('Site ayarlarını herkes okur (varsayılan iletişim e-postası)', r.rows[0].j.iletisim_eposta === 'bilgi@lykiva.app' && r.rows[0].j.veri_sorumlusu === '', r.rows[0].j);
m = await hataMesaji(() => olarak(C, `select * from site_ayarlari`));
bekle('Ayar tablosu istemciye kapalı', /permission denied/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(C, `select yonetim_site_ayarlari_guncelle('{"iletisim_eposta":"x@y.co"}'::jsonb)`));
bekle('Yönetici olmayan ayarı değiştiremez', /Yönetim yetkisi yok/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(A, `select yonetim_site_ayarlari_guncelle('{"iletisim_eposta":"gecersiz"}'::jsonb)`));
bekle('Geçersiz e-posta reddedilir', /geçersiz/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(A, `select yonetim_site_ayarlari_guncelle('{"baska":"x"}'::jsonb)`));
bekle('Bilinmeyen ayar reddedilir', /Bilinmeyen/.test(m ?? ''), m);
r = await olarak(A, `select yonetim_site_ayarlari_guncelle($1::jsonb) as j`, [JSON.stringify({ iletisim_eposta: ' destek@lykiva.app ', veri_sorumlusu: 'Örnek Kişi' })]);
bekle('Yönetici iletişim e-postasını ve veri sorumlusunu değiştirir (kırpılır)', r.rows[0].j.iletisim_eposta === 'destek@lykiva.app' && r.rows[0].j.veri_sorumlusu === 'Örnek Kişi', r.rows[0].j);

console.log('\nDil ve bildirim dili');
bekle('Yeni profilin dili Türkçe', (await db.query(`select dil from profiles where id = '${C}'`)).rows[0].dil === 'tr', null);
m = await hataMesaji(() => anonOlarak(`select dil_ayarla('en')`));
bekle('Giriş yapmamış biri dil ayarlayamaz', /permission denied/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(C, `select dil_ayarla('fr')`));
bekle('Desteklenmeyen dil reddedilir', /Desteklenmeyen dil/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(C, `update profiles set dil = 'en' where id = $1`, [C]));
bekle('Dil doğrudan tablo yazımıyla değiştirilemez', /permission denied/.test(m ?? ''), m);
await olarak(C, `select dil_ayarla('de')`);
bekle('Kullanıcı kendi dilini kaydeder', (await db.query(`select dil from profiles where id = '${C}'`)).rows[0].dil === 'de', null);
const cAkt = (await db.query(`select id from activities where title = 'C de oradaydı'`)).rows[0].id;
await db.exec(`
  create schema if not exists net;
  delete from push_istekleri;
  create sequence net.istek_sira;
  create table net.cagri (id bigint, url text, body jsonb);
  create table net._http_response (id bigint primary key, status_code integer, content text, created timestamptz default now());
  create function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb, timeout_milliseconds integer default 5000)
  returns bigint language sql as $$ insert into net.cagri values (nextval('net.istek_sira'), url, body) returning id $$;
`);
await olarak(C, `select push_jetonu_kaydet($1, 'android')`, ['ExponentPushToken[dilTelefonu00000003]']);
await olarak(B, `select yorum_yaz($1, 'Guten Morgen')`, [cAkt]);
cagri = (await db.query(`select * from net.cagri`)).rows;
bekle('Telefon bildirimi alıcının dilinde gider (Almanca)', cagri[0]?.body?.[0]?.body === 'Hat kommentiert: „Guten Morgen“' && cagri[0]?.body?.[0]?.title === 'Burak Demir', cagri[0]?.body);
await olarak(C, `select dil_ayarla('ru')`);
await db.exec(`delete from net.cagri`);
await olarak(B, `select yorum_yaz($1, 'Привет')`, [cAkt]);
cagri = (await db.query(`select * from net.cagri`)).rows;
bekle('Telefon bildirimi alıcının dilinde gider (Rusça)', cagri[0]?.body?.[0]?.body === 'Комментарий: «Привет»', cagri[0]?.body);
await olarak(C, `select dil_ayarla('ar')`);
await db.exec(`delete from net.cagri`);
await olarak(B, `select yorum_yaz($1, 'Hello')`, [cAkt]);
cagri = (await db.query(`select * from net.cagri`)).rows;
bekle('Metni henüz olmayan dilde (Arapça) bildirim İngilizce gider', cagri[0]?.body?.[0]?.body === 'Commented: “Hello”', cagri[0]?.body);
await olarak(C, `select dil_ayarla('tr')`);
await db.exec(`drop schema net cascade; delete from push_jetonlari; delete from push_istekleri;`);

console.log('\nHedefler');
const H = 'e1000000-0000-0000-0000-0000000000e1';
const K = 'e2000000-0000-0000-0000-0000000000e2';
const L = 'e3000000-0000-0000-0000-0000000000e3';
const N = 'e4000000-0000-0000-0000-0000000000e4'; // geçici hesap
await db.exec(`
  insert into auth.users (id, is_anonymous, raw_user_meta_data) values
    ('${H}', false, '{"full_name":"Hande Er"}'), ('${K}', false, '{"full_name":"Kaan Ak"}'),
    ('${L}', false, '{"full_name":"Lale Su"}'), ('${N}', true, '{}');
`);
const hedef1 = (await olarak(H, `select hedef_kaydet('hafta', 'mesafe', 100000) as id`)).rows[0].id;
const hedef1b = (await olarak(H, `select hedef_kaydet('hafta', 'mesafe', 150000) as id`)).rows[0].id;
r = await olarak(H, `select id, hedef from hedefler`);
bekle('Aynı dönem + ölçü + tür yeniden kaydedilince güncellenir (tek satır)', hedef1 === hedef1b && r.rows.length === 1 && r.rows[0].hedef === 150000, r.rows);
await olarak(H, `select hedef_kaydet('ay', 'sayi', 12, 'run')`);
await olarak(H, `select hedef_kaydet('ay', 'sayi', 20)`);
bekle('Türlü ve türsüz hedef ayrı tutulur', (await olarak(H, `select count(*)::int as n from hedefler`)).rows[0].n === 3, null);
bekle('Başkasının hedefleri görünmez', (await olarak(K, `select count(*)::int as n from hedefler`)).rows[0].n === 0, null);
m = await hataMesaji(() => olarak(H, `select hedef_kaydet('ay', 'sayi', 2.5)`));
bekle('Aktivite sayısı tam sayı olmalı', /geçersiz/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(H, `select hedef_kaydet('gun', 'mesafe', 1000)`));
bekle('Geçersiz dönem reddedilir', /dönemi geçersiz/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(H, `insert into hedefler (owner_id, donem, olcu, hedef) values ($1, 'yil', 'mesafe', 1)`, [H]));
bekle('Hedef doğrudan tablo yazımıyla eklenemez', /permission denied/.test(m ?? ''), m);
m = await hataMesaji(() => anonOlarak(`select hedef_kaydet('hafta', 'mesafe', 1000)`));
bekle('Giriş yapmamış biri hedef koyamaz', /permission denied/.test(m ?? ''), m);
for (const [d, o] of [['hafta', 'sure'], ['hafta', 'sayi'], ['hafta', 'tirmanis'], ['ay', 'mesafe'], ['ay', 'sure'], ['ay', 'tirmanis'], ['yil', 'mesafe'], ['yil', 'sure'], ['yil', 'sayi']]) {
  await olarak(H, `select hedef_kaydet($1, $2, 100)`, [d, o]);
}
m = await hataMesaji(() => olarak(H, `select hedef_kaydet('yil', 'tirmanis', 100)`));
bekle('En fazla 12 hedef', /En fazla 12/.test(m ?? ''), m);
await olarak(K, `select hedef_sil($1)`, [hedef1]);
bekle('Başkasının hedefi silinemez', (await db.query(`select count(*)::int as n from hedefler where id = '${hedef1}'`)).rows[0].n === 1, null);
await olarak(H, `select hedef_sil($1)`, [hedef1]);
bekle('Sahibi hedefini siler', (await db.query(`select count(*)::int as n from hedefler where id = '${hedef1}'`)).rows[0].n === 0, null);

console.log('\nMeydan okumalar');
// Aktiviteler doğrudan (şimdiye göre): H 2 gün önce 30 km bisiklet + 1 gün önce 10 km koşu, K 1 gün önce 50 km bisiklet (gizli), L 40 gün önce 80 km
await db.exec(`
  insert into activities (owner_id, title, activity, started_at, ended_at, moving_time_s, elapsed_time_s, distance_m, elevation_gain_m, visibility) values
    ('${H}', 'H sürüş', 'bike', now() - interval '2 days', now() - interval '2 days' + interval '1 hour', 3600, 3700, 30000, 300, 'public'),
    ('${H}', 'H koşu', 'run', now() - interval '1 day', now() - interval '1 day' + interval '1 hour', 3000, 3100, 10000, 50, 'public'),
    ('${K}', 'K gizli sürüş', 'bike', now() - interval '1 day', now() - interval '1 day' + interval '2 hours', 7000, 7200, 50000, 600, 'private'),
    ('${L}', 'L eski sürüş', 'bike', now() - interval '40 days', now() - interval '40 days' + interval '3 hours', 10000, 10800, 80000, 900, 'public');
`);
const genel = { baslik: 'Bu ay 100 km bisiklet', olcu: 'mesafe', hedef: 100000, turler: ['bike', 'mtb'], baslangic: new Date(Date.now() - 7 * 86400000).toISOString(), bitis: new Date(Date.now() + 20 * 86400000).toISOString() };
m = await hataMesaji(() => olarak(H, `select meydan_okuma_olustur($1::jsonb)`, [JSON.stringify(genel)]));
bekle('Herkese açık meydan okumayı yalnızca yönetici açar', /Yönetim yetkisi yok/.test(m ?? ''), m);
const mGenel = (await olarak(A, `select meydan_okuma_olustur($1::jsonb) as id`, [JSON.stringify(genel)])).rows[0].id;
m = await hataMesaji(() => olarak(A, `select meydan_okuma_olustur($1::jsonb)`, [JSON.stringify({ ...genel, turler: ['ucak'] })]));
bekle('Geçersiz aktivite türü reddedilir', /türü geçersiz/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(A, `select meydan_okuma_olustur($1::jsonb)`, [JSON.stringify({ ...genel, bitis: new Date(Date.now() - 86400000).toISOString() })]));
bekle('Bitmiş tarihle meydan okuma açılamaz', /gelecekte|sonra/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(A, `select meydan_okuma_olustur($1::jsonb)`, [JSON.stringify({ ...genel, baslangic: new Date(Date.now() - 60 * 86400000).toISOString() })]));
bekle('Başlangıç en fazla bir ay önce olabilir', /bir ay önce/.test(m ?? ''), m);

let ml = (await olarak(H, `select meydan_okumalar_listesi() as j`)).rows[0].j;
bekle('Herkese açık meydan okuma herkesin listesinde; katılmadan değer yok', ml.some((x) => x.id === mGenel && x.katildim === false && x.degerim === null && x.katilimci_sayisi === 0), ml);
await olarak(H, `select meydan_okumaya_katil($1)`, [mGenel]);
await olarak(H, `select meydan_okumaya_katil($1)`, [mGenel]);
await olarak(K, `select meydan_okumaya_katil($1)`, [mGenel]);
await olarak(L, `select meydan_okumaya_katil($1)`, [mGenel]);
await olarak(N, `select meydan_okumaya_katil($1)`, [mGenel], true);
let md = (await olarak(H, `select meydan_okuma_detay($1) as j`, [mGenel])).rows[0].j;
bekle('Yalnızca aralıktaki ve türdeki aktiviteler sayılır (H: 30 km bisiklet, koşu sayılmaz)', md.degerim === 30000 && md.katildim === true, md.degerim);
bekle('Sıralama: K (50 km, gizli aktivite de sayılır) > H > L ve N (0); eşitler aynı sırada', md.siralama.map((x) => `${x.display_name}:${x.sira}`).join(',') === 'Kaan Ak:1,Hande Er:2,Lale Su:3,' + md.siralama[3].display_name + ':3' && md.katilimci_sayisi === 4, md.siralama);
bekle('Benim yerim ayrıca dönüyor; sıralamada aktivite ayrıntısı yok', md.benim?.sira === 2 && md.benim.ben === true && !('title' in md.siralama[0]) && !('activity_id' in md.siralama[0]), md.benim);
bekle('Yalnızca açan / yönetici yönetebilir', md.yonetebilir === false && (await olarak(A, `select meydan_okuma_detay($1) as j`, [mGenel])).rows[0].j.yonetebilir === true, null);
m = await hataMesaji(() => olarak(H, `select meydan_okuma_sil($1)`, [mGenel]));
bekle('Katılımcı herkese açık meydan okumayı silemez', /yetkin yok/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(H, `select * from meydan_okuma_katilimcilari`));
bekle('Katılımcı tablosu doğrudan okunamaz', /permission denied/.test(m ?? ''), m);
m = await hataMesaji(() => anonOlarak(`select meydan_okumalar_listesi()`));
bekle('Giriş yapmamış biri meydan okumaları göremez', /permission denied/.test(m ?? ''), m);
await olarak(L, `select meydan_okumadan_ayril($1)`, [mGenel]);
md = (await olarak(H, `select meydan_okuma_detay($1) as j`, [mGenel])).rows[0].j;
bekle('Ayrılan sıralamadan çıkar', md.katilimci_sayisi === 3 && !md.siralama.some((x) => x.display_name === 'Lale Su'), md.siralama);

// Grup meydan okuması
const hGrup = (await olarak(H, `select grup_olustur('{"name":"Hafta sonu koşucuları"}'::jsonb) as id`)).rows[0].id;
const hKod = (await olarak(H, `select grup_detay($1) ->> 'invite_code' as code`, [hGrup])).rows[0].code;
await olarak(K, `select davetle_katil($1)`, [hKod]);
const grupMO = { baslik: 'Bu hafta 5 aktivite', olcu: 'sayi', hedef: 5, turler: [], baslangic: new Date(Date.now() - 3 * 86400000).toISOString(), bitis: new Date(Date.now() + 4 * 86400000).toISOString(), group_id: hGrup };
m = await hataMesaji(() => olarak(L, `select meydan_okuma_olustur($1::jsonb)`, [JSON.stringify(grupMO)]));
bekle('Grup üyesi olmayan grup meydan okuması açamaz', /üyesi değilsin/.test(m ?? ''), m);
const mGrup = (await olarak(K, `select meydan_okuma_olustur($1::jsonb) as id`, [JSON.stringify(grupMO)])).rows[0].id;
md = (await olarak(K, `select meydan_okuma_detay($1) as j`, [mGrup])).rows[0].j;
bekle('Grup üyesi açar ve kendiliğinden katılır; değer = aktivite sayısı', md.katildim === true && md.degerim === 1 && md.grup_adi === 'Hafta sonu koşucuları' && md.yonetebilir === true, md);
bekle('Grup dışındakiler grup meydan okumasını göremez', (await olarak(L, `select meydan_okuma_detay($1) as j`, [mGrup])).rows[0].j === null
  && !(await olarak(L, `select meydan_okumalar_listesi() as j`)).rows[0].j.some((x) => x.id === mGrup), null);
m = await hataMesaji(() => olarak(L, `select meydan_okumaya_katil($1)`, [mGrup]));
bekle('Grup dışındaki katılamaz', /bulunamadı/.test(m ?? ''), m);
ml = (await olarak(H, `select meydan_okumalar_listesi($1) as j`, [hGrup])).rows[0].j;
bekle('Grup süzgeci yalnızca o grubunkileri verir', ml.length === 1 && ml[0].id === mGrup, ml.map((x) => x.baslik));
await olarak(H, `select meydan_okumaya_katil($1)`, [mGrup]);
await olarak(K, `select gruptan_ayril($1)`, [hGrup]);
md = (await olarak(H, `select meydan_okuma_detay($1) as j`, [mGrup])).rows[0].j;
bekle('Gruptan ayrılan grup meydan okumasından da çıkar (herkese açıktaki katılımı sürer)', md.katilimci_sayisi === 1
  && (await db.query(`select count(*)::int as n from meydan_okuma_katilimcilari where user_id = '${K}' and meydan_okuma_id = '${mGenel}'`)).rows[0].n === 1, md.siralama);
bekle('Grup yöneticisi (H), başkasının açtığı meydan okumayı yönetebilir', md.yonetebilir === true, md);

// Bitmiş meydan okuma: katılım kapalı, katıldıysan listede kalır
const bitmis = (await db.query(`insert into meydan_okumalar (baslik, olcu, hedef, baslangic, bitis) values ('Geçen ay', 'mesafe', 50000, now() - interval '70 days', now() - interval '40 days') returning id`)).rows[0].id;
const bitmis2 = (await db.query(`insert into meydan_okumalar (baslik, olcu, hedef, baslangic, bitis) values ('Çok eski', 'mesafe', 50000, now() - interval '90 days', now() - interval '60 days') returning id`)).rows[0].id;
await db.exec(`insert into meydan_okuma_katilimcilari (meydan_okuma_id, user_id) values ('${bitmis}', '${L}')`);
m = await hataMesaji(() => olarak(H, `select meydan_okumaya_katil($1)`, [bitmis]));
bekle('Bitmiş meydan okumaya katılınamaz', /bitti/.test(m ?? ''), m);
ml = (await olarak(L, `select meydan_okumalar_listesi() as j`)).rows[0].j;
const lBitmis = ml.find((x) => x.id === bitmis);
bekle('Katıldığın bitmiş meydan okuma listede kalır, değeri tamamlanmış (80 km)', lBitmis?.degerim === 80000 && !ml.some((x) => x.id === bitmis2), ml.map((x) => x.baslik));

// Yönetim
let ymo = (await olarak(A, `select yonetim_meydan_okumalar('koşucu') as j`)).rows[0].j;
bekle('Yönetimde grup meydan okuması da aranır', ymo.toplam === 1 && ymo.satirlar[0].grup === 'Hafta sonu koşucuları' && ymo.satirlar[0].katilimci === 1, ymo);
m = await hataMesaji(() => olarak(H, `select yonetim_meydan_okumalar()`));
bekle('Yönetici olmayan yönetim listesini göremez', /Yönetim yetkisi yok/.test(m ?? ''), m);
await olarak(A, `select meydan_okuma_sil($1)`, [mGrup]);
bekle('Site yöneticisi grup meydan okumasını siler', (await db.query(`select count(*)::int as n from meydan_okumalar where id = '${mGrup}'`)).rows[0].n === 0, null);

console.log('\nHesap devri: hedefler ve meydan okumalar');
await olarak(N, `select hedef_kaydet('hafta', 'sayi', 3)`, [], true);
await olarak(N, `select hedef_kaydet('yil', 'mesafe', 2000000)`, [], true);
await olarak(L, `select hedef_kaydet('yil', 'mesafe', 1000000)`);
const devirN = (await olarak(N, `select devir_kodu_al() as k`, [], true)).rows[0].k;
await olarak(L, `select hesabi_devral($1)`, [devirN]);
r = await db.query(`select donem, olcu, hedef from hedefler where owner_id = '${L}' order by donem`);
bekle('Geçici hesabın hedefi taşınır; asıl hesapta aynısı varsa asıl hesabınki kalır', r.rows.length === 2 && r.rows.find((x) => x.donem === 'yil').hedef === 1000000 && r.rows.find((x) => x.donem === 'hafta').hedef === 3, r.rows);
md = (await olarak(L, `select meydan_okuma_detay($1) as j`, [mGenel])).rows[0].j;
bekle('Meydan okuma katılımı asıl hesaba taşınır', md.katildim === true && (await db.query(`select count(*)::int as n from meydan_okuma_katilimcilari where user_id = '${N}'`)).rows[0].n === 0, md.katildim);

console.log('\nIsı haritaları');
// Erciyes civarında, öbür senaryolardan uzak: aynı hat üzerinde beş kişinin aktivitesi
const IP = 'd1510000-0000-0000-0000-0000000000d1'; // herkese açık, gündüz, dün, uçlar açık
const IR = 'd2510000-0000-0000-0000-0000000000d2'; // herkese açık, gece, 30 gün önce, uçlar gizli
const IS = 'd3510000-0000-0000-0000-0000000000d3'; // gizli aktivite
const IT = 'd4510000-0000-0000-0000-0000000000d4'; // ısı haritasından çıkmış
const IU = 'd5510000-0000-0000-0000-0000000000d5'; // engellenmiş
await db.exec(`
  insert into auth.users (id, raw_user_meta_data, banned_until) values
    ('${IP}', '{"full_name":"Pelin"}', null), ('${IR}', '{"full_name":"Rıza"}', null), ('${IS}', '{"full_name":"Selin"}', null),
    ('${IT}', '{"full_name":"Tolga"}', null), ('${IU}', '{"full_name":"Ufuk"}', now() + interval '10 years');
`);
const hat = `'LINESTRING Z(35.50 38.50 1000, 35.51 38.501 1010, 35.52 38.50 1020, 35.53 38.501 1030)'`;
const gunduz = `date_trunc('day', now()) - interval '1 day' + interval '9 hours'`; // 09:00 UTC ≈ 11:20 güneş saati
const gece = `date_trunc('day', now()) - interval '30 days' + interval '23 hours'`; // 23:00 UTC ≈ 01:20 güneş saati
await db.exec(`
  insert into activities (owner_id, title, activity, started_at, ended_at, moving_time_s, elapsed_time_s, distance_m, visibility, hide_endpoints, track) values
    ('${IP}', 'P', 'bike', ${gunduz}, ${gunduz} + interval '20 minutes', 1200, 1200, 2700, 'public', false, ${hat}::geography),
    ('${IR}', 'R', 'run', ${gece}, ${gece} + interval '30 minutes', 1800, 1800, 2700, 'public', true, ${hat}::geography),
    ('${IS}', 'S', 'bike', ${gunduz}, ${gunduz} + interval '20 minutes', 1200, 1200, 2700, 'private', false, ${hat}::geography),
    ('${IT}', 'T', 'bike', ${gunduz}, ${gunduz} + interval '20 minutes', 1200, 1200, 2700, 'public', false, ${hat}::geography),
    ('${IU}', 'U', 'bike', ${gunduz}, ${gunduz} + interval '20 minutes', 1200, 1200, 2700, 'public', false, ${hat}::geography);
`);
await olarak(IT, `select isi_haritasi_ayarla(false)`);
const isi = async (u, tur, zoom = 14, kutu = [35.45, 38.45, 35.6, 38.55]) =>
  (await olarak(u, `select isi_haritasi($1, $2, $3, $4, $5, $6) as j`, [tur, ...kutu, zoom])).rows[0].j;
const enCok = (h) => Math.max(0, ...h.map((x) => x[2]));
let ih = await isi(IP, 'kuresel');
bekle('Küresel: herkese açık iki aktivite (gizli, çıkmış ve engellenmiş sayılmaz)', ih.length > 10 && enCok(ih) === 2, enCok(ih));
ih = await isi(IP, 'haftalik');
bekle('Haftalık: yalnızca son 7 gün', ih.length > 0 && enCok(ih) === 1, enCok(ih));
ih = await isi(IP, 'gece');
bekle('Gece: yalnızca güneş batıkken yapılan; uçları gizliyse baştan 200 m yok', ih.length > 0 && enCok(ih) === 1 && Math.min(...ih.map((x) => x[0])) > 35.502, Math.min(...ih.map((x) => x[0])));
ih = await isi(IS, 'kisisel');
bekle('Kişisel: kendi gizli aktiviten de görünür', ih.length > 0 && enCok(ih) === 1, ih.length);
ih = await isi(IS, 'kisisel', 5, [30, 35, 40, 42]);
bekle('Kişisel uzaktan da görünür', ih.length > 0, ih.length);
ih = await isi(IP, 'kuresel', 7, [30, 35, 40, 42]);
bekle('Küresel 8. yakınlaştırmadan önce boş', ih.length === 0, ih.length);
ih = await isi(IP, 'kuresel', 14, [29.5, 36.1, 29.7, 36.3]);
bekle('Başka bir alanda bu aktiviteler yok', !ih.some((x) => x[0] > 35), ih.length);
m = await hataMesaji(() => isi(IP, 'herkes'));
bekle('Bilinmeyen tür reddedilir', /Bilinmeyen/.test(m ?? ''), m);
m = await hataMesaji(() => anonOlarak(`select isi_haritasi('kuresel', 35.45, 38.45, 35.6, 38.55, 14)`));
bekle('Oturumsuz ısı haritası yok', !!m, m);
await olarak(IT, `select isi_haritasi_ayarla(true)`);
ih = await isi(IP, 'kuresel');
bekle('Isı haritasına geri dönen sayılır', enCok(ih) === 3, enCok(ih));
r = await db.query(`select round(gunes_yuksekligi('2026-06-21 12:00+00', 0, 23.44)::numeric) as ogle, gunes_yuksekligi('2026-06-21 00:00+00', 0, 23.44) < -6 as gece`);
bekle('Güneş yüksekliği: dönencede yaz öğlesi ~90°, gece yarısı ufkun altında', Number(r.rows[0].ogle) >= 88 && r.rows[0].gece, r.rows[0]);

console.log('\nGizlilik kontrolleri');
// Gül ayarları değiştirir; Barış onu takip eder; Gül, Can'ı takip eder (tanıdık ama takipçisi değil); Deniz yabancı
const PG = '61000000-0000-0000-0000-000000000061';
const PB = '62000000-0000-0000-0000-000000000062';
const PC = '63000000-0000-0000-0000-000000000063';
const PD = '64000000-0000-0000-0000-000000000064';
await db.exec(`
  insert into auth.users (id, raw_user_meta_data) values
    ('${PG}', '{"full_name":"Gül Gizli"}'), ('${PB}', '{"full_name":"Barış Takipçi"}'),
    ('${PC}', '{"full_name":"Can Tanıdık"}'), ('${PD}', '{"full_name":"Deniz Yabancı"}');
  update profiles set bio = 'Dağ bisikleti', city = 'Fethiye' where id = '${PG}';
  insert into follows (follower_id, followee_id) values ('${PB}', '${PG}'), ('${PG}', '${PC}');
`);
const gizlilik = (u, alan, deger, gecmis = false) => olarak(u, `select gizlilik_ayarla($1, $2, $3) as n`, [alan, deger, gecmis]).then((x) => x.rows[0].n);
const profilOf = async (u, kisi) => (await olarak(u, `select kisi_profili($1) as j`, [kisi])).rows[0].j;
const ayarlar = async () => (await db.query(`select profil_gizliligi, aktivite_gizliligi, grup_aktivite_gizliligi, bahsetme_izni from profiles where id = '${PG}'`)).rows[0];

let ay = await ayarlar();
bekle('Varsayılanlar: profil herkes, aktiviteler takipçiler, grup aktiviteleri herkes, bahsetme herkes',
  ay.profil_gizliligi === 'herkes' && ay.aktivite_gizliligi === 'takipciler' && ay.grup_aktivite_gizliligi === 'herkes' && ay.bahsetme_izni === 'herkes', ay);
let kpG = await profilOf(PD, PG);
bekle('Profil herkese açıkken yabancı ayrıntıları görür', kpG.kisitli === false && kpG.bio === 'Dağ bisikleti' && kpG.follower_count === 1, kpG);

await gizlilik(PG, 'profil_gizliligi', 'takipciler');
kpG = await profilOf(PD, PG);
bekle('Profil takipçilere: yabancı yalnızca adı görür', kpG.kisitli === true && kpG.bio === null && kpG.city === null && kpG.follower_count === 0 && kpG.display_name === 'Gül Gizli', kpG);
kpG = await profilOf(PB, PG);
bekle('Profil takipçilere: takipçi ayrıntıları görür', kpG.kisitli === false && kpG.city === 'Fethiye', kpG);
r = await olarak(PD, `select takip_listesi($1, 'takipci') as j`, [PG]);
bekle('Profil takipçilere: yabancıya takip listesi boş', r.rows[0].j.length === 0, r.rows[0].j);
r = await olarak(PB, `select takip_listesi($1, 'takipci') as j`, [PG]);
bekle('Profil takipçilere: takipçi listeyi görür', r.rows[0].j.length === 1, r.rows[0].j);
const gulAdi = (await db.query(`select username from profiles where id = '${PG}'`)).rows[0].username;
r = await anonOlarak(`select herkese_acik_profil($1) as j`, [gulAdi]);
bekle('Profil herkese açık değilse web profili yok', r.rows[0].j === null, r.rows[0].j);

await gizlilik(PG, 'profil_gizliligi', 'kimse');
kpG = await profilOf(PB, PG);
bekle('Profil hiç kimseye: takipçi de yalnızca adı görür', kpG.kisitli === true && kpG.bio === null, kpG);
kpG = await profilOf(PG, PG);
bekle('Kendi profilini her zaman tam görür', kpG.kisitli === false && kpG.bio === 'Dağ bisikleti', kpG);
m = await hataMesaji(() => gizlilik(PG, 'isi_haritasinda', 'kimse'));
bekle('Bilinmeyen ayar reddedilir', /Bilinmeyen/.test(m ?? ''), m);
m = await hataMesaji(() => gizlilik(PG, 'profil_gizliligi', 'arkadaslar'));
bekle('Geçersiz seçim reddedilir', /Geçersiz/.test(m ?? ''), m);
m = await hataMesaji(() => anonOlarak(`select gizlilik_ayarla('profil_gizliligi', 'herkes', false)`));
bekle('Oturumsuz ayar değiştirilemez', !!m, m);
await gizlilik(PG, 'profil_gizliligi', 'herkes');

// Aktiviteler: görünürlük verilmeyen yeni kayıt kişinin varsayılanıyla açılır; geçmişe uygulanabilir
await gizlilik(PG, 'aktivite_gizliligi', 'kimse');
const gOzel = await aktivite(PG, 'Gül varsayılan', undefined, 28.1, 36.6, 40);
const gAcik = await aktivite(PG, 'Gül açık', 'public', 28.1, 36.6, 41);
r = await db.query(`select id, visibility from activities where id in ('${gOzel}', '${gAcik}')`);
bekle('Aktiviteler hiç kimseye: görünürlüğü verilmeyen kayıt özel; açıkça seçilen korunur',
  r.rows.find((x) => x.id === gOzel).visibility === 'private' && r.rows.find((x) => x.id === gAcik).visibility === 'public', r.rows);
let degisen = await gizlilik(PG, 'aktivite_gizliligi', 'takipciler', true);
r = await db.query(`select count(*)::int as n from activities where owner_id = '${PG}' and visibility = 'followers'`);
bekle('Geçmişe uygula: bütün aktiviteler takipçilere', degisen === 2 && r.rows[0].n === 2, { degisen, n: r.rows[0].n });
degisen = await gizlilik(PG, 'aktivite_gizliligi', 'herkes');
r = await db.query(`select count(*)::int as n from activities where owner_id = '${PG}' and visibility = 'followers'`);
bekle('Geçmişe uygulanmazsa eski aktiviteler değişmez', degisen === 0 && r.rows[0].n === 2, { degisen, n: r.rows[0].n });

// Grup aktiviteleri: Can, Gül'ü kendi herkese açık aktivitesine etiketler
const cBirlikte = await aktivite(PC, 'Can ile Gül', 'public', 28.2, 36.7, 42);
await olarak(PC, `select birlikte_ekle($1, $2::uuid[])`, [cBirlikte, [PG]]);
const birlikte = async (u) => (await olarak(u, `select birlikte_kisiler($1) as j`, [cBirlikte])).rows[0].j.map((x) => x.user_id);
bekle('Grup aktiviteleri herkese: yabancı Gül\'ü etiketli görür', (await birlikte(PD)).includes(PG), await birlikte(PD));
await gizlilik(PG, 'grup_aktivite_gizliligi', 'takipciler');
bekle('Grup aktiviteleri takipçilere: yabancı görmez, takipçi görür', !(await birlikte(PD)).includes(PG) && (await birlikte(PB)).includes(PG), [await birlikte(PD), await birlikte(PB)]);
await gizlilik(PG, 'grup_aktivite_gizliligi', 'kimse');
bekle('Grup aktiviteleri hiç kimseye: takipçi görmez; aktivitenin sahibi ve kendisi görür',
  !(await birlikte(PB)).includes(PG) && (await birlikte(PC)).includes(PG) && (await birlikte(PG)).includes(PG), [await birlikte(PB), await birlikte(PC)]);
r = await olarak(PB, `select count(*)::int as n from activity_participants where activity_id = $1`, [cBirlikte]);
bekle('Grup aktiviteleri: tablodan doğrudan okunamaz', r.rows[0].n === 0, r.rows[0].n);
await olarak(PB, `insert into follows (follower_id, followee_id) values ($1, $2)`, [PB, PC]);
const gKart = (await olarak(PB, `select akis('takip') as j`)).rows[0].j.find((x) => x.id === cBirlikte);
bekle('Grup aktiviteleri: akış kartında da sayılmaz', gKart && gKart.with_count === 0 && gKart.with.length === 0, gKart && { with: gKart.with, n: gKart.with_count });
await gizlilik(PG, 'grup_aktivite_gizliligi', 'herkes');

// Bahsetmeler: Can tanıdık ama Gül'ü takip etmiyor; Barış takip ediyor (ve Gül'le tanıdık)
const cIkinci = await aktivite(PC, 'Can ikinci', 'public', 28.2, 36.7, 43);
const bIkinci = await aktivite(PB, 'Barış', 'public', 28.2, 36.7, 44);
await gizlilik(PG, 'bahsetme_izni', 'takipciler');
m = await hataMesaji(() => olarak(PC, `select birlikte_ekle($1, $2::uuid[])`, [cIkinci, [PG]]));
bekle('Bahsetme takipçilere: takipçi olmayan tanıdık etiketleyemez', /izin vermiyor/.test(m ?? ''), m);
const bEklenen = (await olarak(PB, `select birlikte_ekle($1, $2::uuid[]) as n`, [bIkinci, [PG]])).rows[0].n;
bekle('Bahsetme takipçilere: takipçi etiketler', bEklenen === 1, bEklenen);
await gizlilik(PG, 'bahsetme_izni', 'kimse');
await olarak(PB, `select birlikte_cikar($1, $2)`, [bIkinci, PG]);
m = await hataMesaji(() => olarak(PB, `select birlikte_ekle($1, $2::uuid[])`, [bIkinci, [PG]]));
bekle('Bahsetme hiç kimseye: takipçi de etiketleyemez', /izin vermiyor/.test(m ?? ''), m);

console.log('\nEngelleme');
// Ece, Efe'yi engeller; Eda yabancı
const EA = '71000000-0000-0000-0000-000000000071';
const EB = '72000000-0000-0000-0000-000000000072';
const EC = '73000000-0000-0000-0000-000000000073';
await db.exec(`
  insert into auth.users (id, raw_user_meta_data) values
    ('${EA}', '{"full_name":"Ece Engelleyen"}'), ('${EB}', '{"full_name":"Efe Engellenen"}'), ('${EC}', '{"full_name":"Eda Yabancı"}');
  insert into follows (follower_id, followee_id) values ('${EA}', '${EB}'), ('${EB}', '${EA}');
`);
const engAkt = await aktivite(EA, 'Ece açık', 'public', 27.1, 38.4, 50);
const bAkt = await aktivite(EB, 'Efe açık', 'public', 27.1, 38.4, 51);
await olarak(EA, `select birlikte_ekle($1, $2::uuid[])`, [engAkt, [EB]]);
await olarak(EB, `select birlikte_ekle($1, $2::uuid[])`, [bAkt, [EA]]);
const goruyor = async (u, id) => (await olarak(u, `select count(*)::int as n from aktivite_ozetleri where id = $1`, [id])).rows[0].n === 1;
bekle('Engelden önce Efe, Ece\'nin aktivitesini görür', await goruyor(EB, engAkt), null);

m = await hataMesaji(() => olarak(EA, `select kisi_engelle($1, true)`, [EA]));
bekle('Kendini engelleyemezsin', /Kendini/.test(m ?? ''), m);
await olarak(EA, `select kisi_engelle($1, true)`, [EB]);
r = await db.query(`select (select count(*) from follows where (follower_id = '${EA}' and followee_id = '${EB}') or (follower_id = '${EB}' and followee_id = '${EA}'))::int as f,
  (select count(*) from activity_participants where activity_id in ('${engAkt}', '${bAkt}'))::int as p`);
bekle('Engellenince iki yöndeki takip ve karşılıklı etiketler kalkar', r.rows[0].f === 0 && r.rows[0].p === 0, r.rows[0]);
bekle('Engellenen, engelleyenin aktivitesini göremez', !(await goruyor(EB, engAkt)), null);
bekle('Engelleyen de engellediğinin aktivitesini göremez', !(await goruyor(EA, bAkt)), null);
bekle('Yabancı ikisini de görmeye devam eder', (await goruyor(EC, engAkt)) && (await goruyor(EC, bAkt)), null);
r = await olarak(EB, `select kisi_profili($1) as j`, [EA]);
bekle('Engellenen için engelleyenin profili yok', r.rows[0].j === null, r.rows[0].j);
r = await olarak(EA, `select kisi_profili($1) as j`, [EB]);
bekle('Engelleyen engellediğini yalnızca adıyla görür (engelledim)', r.rows[0].j.engelledim === true && r.rows[0].j.kisitli === true && r.rows[0].j.bio === null, r.rows[0].j);
r = await olarak(EB, `select kisi_ara('ece') as j`);
bekle('Engellenen aramada engelleyeni bulamaz', !r.rows[0].j.some((x) => x.id === EA), r.rows[0].j);
m = await hataMesaji(() => olarak(EB, `insert into follows (follower_id, followee_id) values ($1, $2)`, [EB, EA]));
bekle('Engellenen takip edemez', /row-level security/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(EB, `select yorum_yaz($1, 'merhaba')`, [engAkt]));
bekle('Engellenen yorum yazamaz', /göremiyorsun/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(EA, `select birlikte_ekle($1, $2::uuid[])`, [engAkt, [EB]]));
bekle('Engellenen etiketlenemez', !!m, m);
r = await olarak(EA, `select engellenenler() as j`);
bekle('Engellenenler listesinde Efe var', r.rows[0].j.length === 1 && r.rows[0].j[0].id === EB, r.rows[0].j);
r = await olarak(EB, `select count(*)::int as n from engellemeler`);
bekle('Engellenen, engellendiğini tablodan okuyamaz', r.rows[0].n === 0, r.rows[0].n);
m = await hataMesaji(() => olarak(EB, `delete from engellemeler where engelleyen = $1`, [EA]));
bekle('Engel tablodan doğrudan silinemez', /permission denied/.test(m ?? ''), m);
await olarak(EA, `select kisi_engelle($1, false)`, [EB]);
bekle('Engel kalkınca aktivite yeniden görünür', await goruyor(EB, engAkt), null);
r = await olarak(EA, `select engellenenler() as j`);
bekle('Engel kalkınca liste boş', r.rows[0].j.length === 0, r.rows[0].j);

console.log('\nEk gizlilik kontrolleri');
// Harita görünürlüğü: hide_endpoints verilmeyen kayıt kişinin varsayılanıyla açılır
async function hamAktivite(uid, baslik, gun, ekle = {}) {
  const pts = iz(26.5, 39.0).map((p) => ({ ...p, t: p.t + gun * 86400000 }));
  const p = {
    title: baslik, activity: 'run', started_at: new Date(pts[0].t).toISOString(), ended_at: new Date(pts.at(-1).t).toISOString(),
    moving_time_s: 590, elapsed_time_s: 600, distance_m: 2500, elevation_gain_m: 59, elevation_loss_m: 0, max_elevation_m: 159,
    avg_speed_mps: 4.2, max_speed_mps: 8, min_moving_speed_mps: 1, points: pts,
    stops: [{ startT: pts[10].t, endT: pts[12].t, lng: pts[10].lng, lat: pts[10].lat, distanceAtM: 400 }], ...ekle,
  };
  return (await olarak(uid, `select kaydet_aktivite($1::jsonb) as id`, [JSON.stringify(p)])).rows[0].id;
}
const bayrak = (u, alan, deger) => olarak(u, `select gizlilik_bayragi_ayarla($1, $2)`, [alan, deger]);
await bayrak(EA, 'uclari_gizle', false);
const hAcik = await hamAktivite(EA, 'Uçlar açık', 52, { visibility: 'public' });
const hGizli = await hamAktivite(EA, 'Uçlar gizli', 53, { visibility: 'public', hide_endpoints: true });
r = await db.query(`select id, hide_endpoints from activities where id in ('${hAcik}', '${hGizli}')`);
bekle('Harita: uçları gizleme kapalıyken yeni kayıt açık; açıkça istenen korunur',
  r.rows.find((x) => x.id === hAcik).hide_endpoints === false && r.rows.find((x) => x.id === hGizli).hide_endpoints === true, r.rows);
let n = (await olarak(EA, `select gecmis_aktiviteleri_duzenle(null, true) as n`)).rows[0].n;
r = await db.query(`select count(*) filter (where not hide_endpoints)::int as acik, count(*)::int as hepsi from activities where owner_id = '${EA}'`);
bekle('Geçmiş aktiviteleri düzenle: uçlar hepsinde gizlendi', n === 1 && r.rows[0].acik === 0, { n, ...r.rows[0] });
n = (await olarak(EA, `select gecmis_aktiviteleri_duzenle('followers', null) as n`)).rows[0].n;
r = await db.query(`select count(*) filter (where visibility <> 'followers')::int as baska from activities where owner_id = '${EA}'`);
bekle('Geçmiş aktiviteleri düzenle: hepsi takipçilere', n === 3 && r.rows[0].baska === 0, { n, ...r.rows[0] });
m = await hataMesaji(() => olarak(EA, `select gecmis_aktiviteleri_duzenle(null, null)`));
bekle('Geçmiş aktiviteleri düzenle: boş istek reddedilir', /seçilmedi/.test(m ?? ''), m);
await olarak(EA, `select gecmis_aktiviteleri_duzenle('public', null)`);

// Gizli ayrıntılar: hız ve molalar
await bayrak(EA, 'gizli_hiz', true);
const ozet = async (u) => (await olarak(u, `select avg_speed_mps, max_speed_mps from aktivite_ozetleri where id = $1`, [hAcik])).rows[0];
const detay = async (u) => (await olarak(u, `select aktivite_detay($1) as j`, [hAcik])).rows[0].j;
let hizOz = await ozet(EC);
bekle('Hız gizli: başkası ortalama ve en yüksek hızı göremez', hizOz.avg_speed_mps === null && hizOz.max_speed_mps === null, hizOz);
hizOz = await ozet(EA);
bekle('Hız gizli: sahibi görür', hizOz.avg_speed_mps === 4.2 && hizOz.max_speed_mps === 8, hizOz);
let dt = await detay(EC);
bekle('Hız gizli: hız grafiği boş, yükseklik duruyor', dt.profile.length > 0 && dt.profile.every((x) => x.speed === null) && dt.profile.some((x) => x.alt !== null), dt.profile[0]);
bekle('Hız gizliyken molalar görünür', dt.stops.length === 1, dt.stops.length);
await bayrak(EA, 'gizli_molalar', true);
dt = await detay(EC);
r = await olarak(EC, `select count(*)::int as n from activity_stops where activity_id = $1`, [hAcik]);
bekle('Molalar gizli: başkası mola noktalarını göremez (tablodan da)', dt.stops.length === 0 && r.rows[0].n === 0, { stops: dt.stops.length, n: r.rows[0].n });
bekle('Molalar gizli: sahibi görür', (await detay(EA)).stops.length === 1, null);
const ecKart = (await olarak(EC, `select akis('yakin', null, null, 26.5, 39.0) as j`)).rows[0].j.find((x) => x.id === hAcik);
bekle('Akış kartı: hız ve mola sayısı gizli', ecKart && ecKart.avg_speed_mps === null && ecKart.stop_count === 0, ecKart && { hiz: ecKart.avg_speed_mps, mola: ecKart.stop_count });

// Kişisel bilgilerimi paylaşmayın: tercih kaydı
await bayrak(EA, 'kisisel_veri_paylasimi_kapali', true);
r = await db.query(`select kisisel_veri_paylasimi_kapali as k from profiles where id = '${EA}'`);
bekle('Kişisel bilgilerimi paylaşmayın tercihi kaydedilir', r.rows[0].k === true, r.rows[0]);
m = await hataMesaji(() => bayrak(EA, 'is_admin', true));
bekle('Bilinmeyen bayrak (ör. is_admin) reddedilir', /Bilinmeyen/.test(m ?? ''), m);

// Meydan okuma katılımı: K sıralamada gizlenir
await gizlilik(K, 'meydan_okuma_gizliligi', 'kimse');
md = (await olarak(H, `select meydan_okuma_detay($1) as j`, [mGenel])).rows[0].j;
let kSatiri = md.siralama.filter((x) => x.gizli);
bekle('Meydan okuma gizli: başkası adını görmez, sırası ve değeri durur',
  kSatiri.length === 1 && kSatiri[0].user_id === null && kSatiri[0].display_name === null && typeof kSatiri[0].sira === 'number' && !md.siralama.some((x) => x.user_id === K), md.siralama);
md = (await olarak(K, `select meydan_okuma_detay($1) as j`, [mGenel])).rows[0].j;
bekle('Meydan okuma gizli: kendisi adını ve yerini görür', md.benim && md.benim.ben === true && md.benim.gizli === false, md.benim);
await gizlilik(K, 'meydan_okuma_gizliligi', 'herkes');

console.log('\nKulüpler: grup fotoğrafı, gönderiler, haftalık istatistik');
const KA = 'd1000000-0000-0000-0000-0000000000d1';
const KB = 'd2000000-0000-0000-0000-0000000000d2';
const KC = 'd3000000-0000-0000-0000-0000000000d3';
await db.exec(`
  insert into auth.users (id, is_anonymous, raw_user_meta_data) values
    ('${KA}', false, '{"full_name":"Kaan Aksoy"}'),
    ('${KB}', false, '{"full_name":"Kerem Bulut"}'),
    ('${KC}', false, '{"full_name":"Kübra Can"}');
`);
const kGrup = (await olarak(KA, `select grup_olustur('{"name":"Pedal Kulübü","is_private":false,"is_community":true}'::jsonb) as id`)).rows[0].id;
await olarak(KB, `select gruba_katil($1)`, [kGrup]);
const kFoto = `${kGrup}/${u1}.jpg`;

// Grup fotoğrafı: yalnızca yönetici yükler, adresi gruba yazar; keşfette de görünür
await olarak(KA, `insert into storage.objects (bucket_id, name) values ('grup', $1)`, [kFoto]);
m = await hataMesaji(() => olarak(KB, `insert into storage.objects (bucket_id, name) values ('grup', $1)`, [`${kGrup}/${u2}.jpg`]));
bekle('Grup fotoğrafı: yönetici olmayan üye yükleyemez', /row-level security/.test(m ?? ''), m);
await olarak(KB, `delete from storage.objects where bucket_id = 'grup' and name = $1`, [kFoto]);
bekle('Grup fotoğrafı: yönetici olmayan silemez', (await db.query(`select count(*)::int n from storage.objects where bucket_id = 'grup'`)).rows[0].n === 1, null);
const kAdres = `https://api.lykiva.app/storage/v1/object/public/grup/${kFoto}`;
await olarak(KA, `update groups set avatar_url = $2 where id = $1`, [kGrup, kAdres]);
m = await hataMesaji(() => olarak(KA, `update groups set avatar_url = 'javascript:alert(1)' where id = $1`, [kGrup]));
bekle('Grup fotoğrafı: https olmayan adres reddedilir', /grup_foto_adresi/.test(m ?? ''), m);
await olarak(KB, `update groups set avatar_url = null where id = $1`, [kGrup]);
r = await olarak(KC, `select kesfet_gruplar() as j`);
bekle('Grup fotoğrafı: üye olmayan değiştiremez, keşfette görür', r.rows[0].j.find((x) => x.id === kGrup)?.avatar_url === kAdres, r.rows[0].j);
r = await olarak(KB, `select grup_detay($1) as d, gruplarim() as l`, [kGrup]);
bekle('Grup fotoğrafı: grup_detay ve gruplarim adresi döner', r.rows[0].d.avatar_url === kAdres && r.rows[0].l.find((x) => x.id === kGrup)?.avatar_url === kAdres, r.rows[0].d);

// Gönderiler
const gFoto = `${kGrup}/${u2}.jpg`;
m = await hataMesaji(() => olarak(KC, `insert into storage.objects (bucket_id, name) values ('grup_gonderi', $1)`, [gFoto]));
bekle('Gönderi fotoğrafı: üye olmayan yükleyemez', /row-level security/.test(m ?? ''), m);
await olarak(KB, `insert into storage.objects (bucket_id, name) values ('grup_gonderi', $1)`, [gFoto]);
m = await hataMesaji(() => olarak(KC, `select grup_gonderisi_paylas($1, 'merhaba')`, [kGrup]));
bekle('Gönderi: üye olmayan paylaşamaz', /üyesi değilsin/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(KB, `select grup_gonderisi_paylas($1, '   ', '{}')`, [kGrup]));
bekle('Gönderi: boş gönderi reddedilir', /Boş/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(KB, `select grup_gonderisi_paylas($1, 'x', $2::text[])`, [kGrup, [`${KA}/${u1}.jpg`]]));
bekle('Gönderi: başka klasördeki fotoğraf reddedilir', /geçersiz/.test(m ?? ''), m);
m = await hataMesaji(() => olarak(KB, `select grup_gonderisi_paylas($1, 'x', $2::text[])`, [kGrup, Array.from({ length: 5 }, () => gFoto)]));
bekle('Gönderi: en fazla 4 fotoğraf', /geçersiz/.test(m ?? ''), m);
const gon = (await olarak(KB, `select grup_gonderisi_paylas($1, '  İlk tur, pazar 08:00  ', $2::text[]) as id`, [kGrup, [gFoto]])).rows[0].id;
await olarak(KA, `select grup_gonderisi_paylas($1, 'Hoş geldin')`, [kGrup]);
r = await olarak(KA, `select grup_gonderileri($1) as j`, [kGrup]);
let gl = r.rows[0].j;
bekle('Gönderiler: yeniden eskiye, metin kırpılmış, fotoğraf yolu duruyor',
  gl.length === 2 && gl[0].body === 'Hoş geldin' && gl[1].body === 'İlk tur, pazar 08:00' && gl[1].photos[0] === gFoto, gl);
bekle('Gönderiler: yönetici başkasının gönderisini silebilir', gl[1].mine === false && gl[1].silebilir === true && gl[1].display_name === 'Kerem Bulut', gl[1]);
r = await olarak(KB, `select grup_gonderileri($1) as j`, [kGrup]);
bekle('Gönderiler: üye yalnızca kendininkini silebilir', r.rows[0].j.find((x) => x.body === 'Hoş geldin')?.silebilir === false && r.rows[0].j.find((x) => x.id === gon)?.silebilir === true, r.rows[0].j);
r = await olarak(KB, `select grup_gonderileri($1, $2) as j`, [kGrup, gl[0].created_at]);
bekle('Gönderiler: sayfalama (once)', r.rows[0].j.length === 1 && r.rows[0].j[0].id === gon, r.rows[0].j);
r = await olarak(KC, `select grup_gonderileri($1) as j`, [kGrup]);
bekle('Gönderiler: üye olmayan göremez', r.rows[0].j.length === 0, r.rows[0].j);
m = await hataMesaji(() => olarak(KB, `select count(*) from grup_gonderileri`));
bekle('Gönderiler: tablo istemciye kapalı', /permission denied/.test(m ?? ''), m);
r = await olarak(KC, `select count(*)::int as n from storage.objects where bucket_id = 'grup_gonderi'`);
const kaGorur = (await olarak(KA, `select count(*)::int as n from storage.objects where bucket_id = 'grup_gonderi'`)).rows[0].n;
bekle('Gönderi fotoğrafı: üye okur, üye olmayan okuyamaz', r.rows[0].n === 0 && kaGorur === 1, { kc: r.rows[0].n, ka: kaGorur });
m = await hataMesaji(() => olarak(KC, `select grup_gonderisi_sil($1)`, [gon]));
bekle('Gönderi: üye olmayan silemez', /yetkin yok/.test(m ?? ''), m);
r = await olarak(KA, `select grup_gonderisi_sil($1) as f`, [gon]);
bekle('Gönderi: yönetici siler, fotoğraf yolları döner', JSON.stringify(r.rows[0].f) === JSON.stringify([gFoto]), r.rows[0].f);
await olarak(KA, `delete from storage.objects where bucket_id = 'grup_gonderi' and name = $1`, [gFoto]);
bekle('Gönderi fotoğrafı: yönetici başkasının dosyasını silebilir', (await db.query(`select count(*)::int n from storage.objects where bucket_id = 'grup_gonderi'`)).rows[0].n === 0, null);

// Haftalık istatistik: bu hafta = Pazartesi 00:00 (Türkiye saati) ve sonrası
const haftaBasi = Date.parse((await db.query(`select (date_trunc('week', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul') as b`)).rows[0].b);
async function kAkt(uid, t0, mesafe, gorunurluk) {
  const pts = iz(30.7, 36.9, 20).map((p, i) => ({ ...p, t: t0 + i * 10000 }));
  const p = {
    title: 'Kulüp turu', activity: 'bike', started_at: new Date(pts[0].t).toISOString(), ended_at: new Date(pts.at(-1).t).toISOString(),
    moving_time_s: 1800, elapsed_time_s: 1900, distance_m: mesafe, elevation_gain_m: 100, elevation_loss_m: 0, max_elevation_m: 200,
    avg_speed_mps: 5, max_speed_mps: 9, min_moving_speed_mps: 1, visibility: gorunurluk, hide_endpoints: true, points: pts, stops: [],
  };
  return (await olarak(uid, `select kaydet_aktivite($1::jsonb) as id`, [JSON.stringify(p)])).rows[0].id;
}
await kAkt(KA, haftaBasi + 60_000, 10000, 'public');
await kAkt(KB, haftaBasi + 120_000, 5000, 'followers');
await kAkt(KB, haftaBasi + 180_000, 3000, 'private');
await kAkt(KA, haftaBasi - 2 * 86400000, 4000, 'public');
await kAkt(KC, haftaBasi + 240_000, 7000, 'public');
r = await olarak(KA, `select grup_haftalik_istatistik($1) as j`, [kGrup]);
let hs = r.rows[0].j;
bekle('Haftalık: takip etmediği üyenin "takipçiler" aktivitesi, gizli aktivite ve üye olmayan sayılmaz',
  hs.mesafe_m === 10000 && hs.aktivite === 1 && hs.aktif_uye === 1 && hs.uye_sayisi === 2, hs);
bekle('Haftalık: geçen hafta ayrı, gün gün toplam Pazartesi\'de', hs.gecen_hafta_mesafe_m === 4000 && hs.gunler.length === 7 && hs.gunler[0] === 10000 && hs.gunler.slice(1).every((x) => x === 0), hs);
r = await olarak(KB, `select grup_haftalik_istatistik($1) as j`, [kGrup]);
hs = r.rows[0].j;
bekle('Haftalık: kendi "takipçiler" aktivitesi sayılır, kendi gizlisi sayılmaz', hs.mesafe_m === 15000 && hs.aktif_uye === 2, hs);
bekle('Haftalık: sıralama mesafeye göre, ben işaretli', hs.siralama.length === 2 && hs.siralama[0].user_id === KA && hs.siralama[1].ben === true && hs.siralama[1].mesafe_m === 5000, hs.siralama);
await olarak(KA, `insert into follows (follower_id, followee_id) values ($1, $2)`, [KA, KB]);
r = await olarak(KA, `select grup_haftalik_istatistik($1) as j`, [kGrup]);
bekle('Haftalık: takip edince "takipçiler" aktivitesi de sayılır', r.rows[0].j.mesafe_m === 15000, r.rows[0].j);
r = await olarak(KC, `select grup_haftalik_istatistik($1) as j`, [kGrup]);
bekle('Haftalık: üye olmayan göremez', r.rows[0].j === null, r.rows[0].j);

console.log(hata ? `\n${hata} senaryo başarısız` : '\nTüm senaryolar geçti');
process.exit(hata ? 1 : 0);
