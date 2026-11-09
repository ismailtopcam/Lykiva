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
create table auth.users (id uuid primary key, is_anonymous boolean not null default false, raw_user_meta_data jsonb default '{}');
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
