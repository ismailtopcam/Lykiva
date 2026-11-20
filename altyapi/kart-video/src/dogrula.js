/**
 * İstek gövdesini denetler ve sahneye gidecek veriyi kurar. Telefon izi ve metinleri kendisi gönderir:
 * iz zaten kullanıcının görebildiği (ve gizlilik ayarına göre uçları kırpılmış) iz, metinler kullanıcının dilinde.
 * Servis veritabanına bağlanmaz.
 */

export const TEMALAR = {
  yorunge: { bicimler: ['hikaye', 'gonderi'], sure: 15 },
  'sehir-gece': { bicimler: ['hikaye', 'gonderi'], sure: 15 },
  'sehir-maket': { bicimler: ['gonderi', 'hikaye'], sure: 15 },
  takip: { bicimler: ['gonderi', 'hikaye'], sure: 20 },
};

/** Tasarım pikseli (CSS) ve çıkış ölçüsü */
export const BICIMLER = {
  hikaye: { w: 360, h: 640, cw: 1080, ch: 1920 },
  gonderi: { w: 432, h: 540, cw: 1080, ch: 1350 },
};

const EN_FAZLA_NOKTA = 5000;

function metin(v, enFazla, ad) {
  if (v == null) return '';
  if (typeof v !== 'string') throw new Error(`${ad} metin olmalı`);
  if (v.length > enFazla) throw new Error(`${ad} en fazla ${enFazla} karakter`);
  return v;
}

/** @returns {{ tema: string, bicim: string, sure: number, rota: [number, number][], hiz: number[] | null, metin: object }} */
export function dogrula(g) {
  if (!g || typeof g !== 'object') throw new Error('gövde JSON nesnesi olmalı');
  const tema = TEMALAR[g.tema] ? g.tema : null;
  if (!tema) throw new Error(`tema şunlardan biri olmalı: ${Object.keys(TEMALAR).join(', ')}`);
  const bicim = g.bicim == null ? TEMALAR[tema].bicimler[0] : g.bicim;
  if (!TEMALAR[tema].bicimler.includes(bicim)) throw new Error(`bu temada biçim: ${TEMALAR[tema].bicimler.join(', ')}`);

  if (!Array.isArray(g.rota) || g.rota.length < 2 || g.rota.length > EN_FAZLA_NOKTA) throw new Error(`rota 2–${EN_FAZLA_NOKTA} nokta olmalı`);
  const rota = g.rota.map((p, i) => {
    if (!Array.isArray(p) || p.length < 2) throw new Error(`rota[${i}] [boylam, enlem] olmalı`);
    const [lng, lat] = [Number(p[0]), Number(p[1])];
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 85) throw new Error(`rota[${i}] geçersiz koordinat`);
    return [Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6];
  });

  // İsteğe bağlı: her noktadaki hız (km/sa). Varsa animasyon rotada kullanıcının hızıyla ilerler;
  // yoksa (eski uygulama, hızı gizli aktivite) düz hızla. Kullanıcı hızını gizlediyse telefon göndermez.
  let hiz = null;
  if (g.hiz != null) {
    if (!Array.isArray(g.hiz) || g.hiz.length !== rota.length) throw new Error('hiz rotayla aynı uzunlukta dizi olmalı');
    hiz = g.hiz.map((v, i) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 400) throw new Error(`hiz[${i}] 0–400 km/sa olmalı`);
      return Math.round(n * 10) / 10;
    });
    if (!hiz.some((v) => v > 0)) hiz = null;
  }

  const m = g.metin && typeof g.metin === 'object' ? g.metin : {};
  const degerler = Array.isArray(m.degerler) ? m.degerler.slice(0, 3) : [];
  const kmSayi = Number(m.kmSayi);
  return {
    tema,
    bicim,
    sure: TEMALAR[tema].sure,
    rota,
    hiz,
    metin: {
      ust: metin(m.ust, 60, 'metin.ust'),
      baslik: metin(m.baslik, 80, 'metin.baslik'),
      kmSayi: Number.isFinite(kmSayi) && kmSayi >= 0 && kmSayi < 100000 ? kmSayi : 0,
      kmBasamak: [0, 1, 2].includes(m.kmBasamak) ? m.kmBasamak : 1,
      ondalik: m.ondalik === '.' ? '.' : ',',
      kmBirim: metin(m.kmBirim, 6, 'metin.kmBirim') || 'km',
      degerler: degerler.map((d, i) => ({ etiket: metin(d?.etiket, 24, `degerler[${i}].etiket`), deger: metin(d?.deger, 24, `degerler[${i}].deger`) })),
      kaynak: metin(m.kaynak, 160, 'metin.kaynak') || '© OpenStreetMap contributors · OpenMapTiles · OpenFreeMap · elevation: Mapzen Terrarium',
    },
  };
}
