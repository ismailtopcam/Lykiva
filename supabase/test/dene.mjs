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
create table auth.users (id uuid primary key, is_anonymous boolean not null default false, raw_user_meta_data jsonb default '{}', email text, created_at timestamptz not null default now(), last_sign_in_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
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

console.log(hata ? `\n${hata} senaryo başarısız` : '\nTüm senaryolar geçti');
process.exit(hata ? 1 : 0);
