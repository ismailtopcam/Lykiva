/**
 * Paylaşım temaları — tasarim/ klasöründeki 2B kartların (01–06, 09, 10) aktivitenin gerçek verisiyle çizilen hâli.
 * Durağan görseldir (animasyon ve video sonraki aşama). Harita zemini gereken kartlar (01, 09) şimdilik haritasız:
 * koyu zemin üstünde rota. 07 Birlikte, 08 Harita posteri ve 3B kartlar (11–17) henüz yok (bkz. DEV_NOTES).
 *
 * Her tema kendi biçiminde (hikâye / gönderi / kare) tasarım pikseliyle çizilir; `TemaGorseli` yakalanacak kökü verir.
 */
import { kmUnit, mUnit } from '@lykiva/shared';
import type { ReactElement, Ref } from 'react';
import { Image, View, type HostInstance } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { Activity, LngLat } from '@/data/ornek';
import { $t } from '@/i18n';
import {
  BICIM_OLCU,
  birlikteAdlar,
  buyuk,
  degerler,
  egriD,
  F,
  gun,
  hizVar,
  izNoktalari,
  kisaSure,
  kisaTarih,
  noktaHizlari,
  Olcekli,
  R,
  T,
  tamTarih,
  tur,
  yenidenOrnekle,
  yolD,
  yukseklikVar,
  type Bicim,
  type Deger,
  type Nokta,
} from './ortak';

export type TemaProps = {
  a: Activity;
  /** Çizilecek iz (gizlilik seçeneğine göre uçları kırpılmış olabilir) */
  route: LngLat[];
  uclariGizle: boolean;
  /** "Fotoğrafın üstünde" teması için kullanıcının seçtiği fotoğraf (yalnızca telefonda kalır) */
  foto?: string | null;
};

export type TemaKimligi = 'gece' | 'foto' | 'zirve' | 'minimal' | 'binis' | 'kartpostal' | 'akis' | 'hiz';

export type Tema = {
  id: TemaKimligi;
  ad: () => string;
  bicim: Bicim;
  /** Hikâyeye (9:16) yerleştirilirken kartın arkasındaki renk */
  zemin: string;
  /** Aktivitede bu tema için gereken veri var mı */
  uygun: (a: Activity) => boolean;
  Bilesen: (p: TemaProps) => ReactElement;
};

const yuvarlak = { strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;

function Logo({ boyut, renk }: { boyut: number; renk: string }) {
  return <T style={{ fontFamily: F.baslikAgir, fontSize: boyut, letterSpacing: -0.02 * boyut, color: renk }}>lykiva</T>;
}

function Ust({ metin, renk, style }: { metin: string; renk: string; style?: object }) {
  return (
    <T numberOfLines={1} style={[{ fontFamily: F.govdeYari, fontSize: 11, letterSpacing: 1.32, color: renk }, style]}>
      {metin}
    </T>
  );
}

function Hucreler({ liste, etiket, deger, boyut, satirAraligi = 1.15 }: { liste: Deger[]; etiket: string; deger: string; boyut: number; satirAraligi?: number }) {
  return (
    <>
      {liste.map((d) => (
        <View key={d.etiket} style={{ flex: 1 }}>
          <T style={{ fontFamily: F.govdeOrta, fontSize: 11, color: etiket }}>{d.etiket}</T>
          <T numberOfLines={1} style={{ fontFamily: F.baslik, fontSize: boyut, lineHeight: boyut * satirAraligi + 2, color: deger }}>
            {d.deger}
          </T>
        </View>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 01 Gece haritası (hikâye)                                           */
/* ------------------------------------------------------------------ */

function GeceHaritasi({ a, route, uclariGizle }: TemaProps) {
  const { pts } = izNoktalari(route, { x: 40, y: 100, w: 280, h: 250 });
  const d = yolD(pts);
  const son = pts[pts.length - 1];
  const kisiler = birlikteAdlar(a);
  return (
    <View style={{ width: 360, height: 640, backgroundColor: R.night, overflow: 'hidden' }}>
      <Svg width={360} height={400} style={{ position: 'absolute', left: 0, top: 0 }}>
        <Defs>
          <RadialGradient id="isik" cx="50%" cy="56%" r="62%">
            <Stop offset="0" stopColor="#25322B" />
            <Stop offset="1" stopColor={R.night} />
          </RadialGradient>
        </Defs>
        <Rect width={360} height={400} fill="url(#isik)" />
        {d ? (
          <>
            {/* Eş yükselti çizgisi izlenimi: izin geniş, soluk kopyaları */}
            {[84, 60, 38].map((w, i) => (
              <Path key={w} d={d} {...yuvarlak} stroke={R.cream} strokeOpacity={0.025 + i * 0.02} strokeWidth={w} />
            ))}
            <Path d={d} {...yuvarlak} stroke={R.night} strokeWidth={10} />
            <Path d={d} {...yuvarlak} stroke={R.orange} strokeWidth={4.8} />
          </>
        ) : null}
        {!uclariGizle && son ? <Circle cx={son[0]} cy={son[1]} r={6} fill={R.night} stroke={R.orange} strokeWidth={2.6} /> : null}
      </Svg>
      <View style={{ position: 'absolute', left: 28, right: 28, bottom: 90 }}>
        <Ust metin={`${buyuk(tur(a))} · ${buyuk(gun(a))}`} renk={R.mutedDark} />
        <T numberOfLines={1} style={{ fontFamily: F.baslik, fontSize: 26, color: R.cream, marginTop: 6 }}>
          {a.title}
        </T>
        <T numberOfLines={1} style={{ fontFamily: F.baslikAgir, fontSize: 66, lineHeight: 70, letterSpacing: -2.6, color: R.cream, marginTop: 2 }}>
          {a.distanceKm}
          <T style={{ fontFamily: F.baslikAgir, fontSize: 26, letterSpacing: 0, color: R.orange }}> {kmUnit()}</T>
        </T>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: R.lineDark }}>
          <Hucreler liste={degerler(a, ['sure', 'tirmanis', 'maks', 'ort'], 3)} etiket={R.mutedDark} deger={R.cream} boyut={20} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22 }}>
          <T numberOfLines={1} style={{ flex: 1, fontFamily: F.govdeYari, fontSize: 12, color: R.mutedDark }}>
            {kisiler.join(' · ')}
          </T>
          <Logo boyut={18} renk={R.cream} />
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* 02 Zirve profili (gönderi)                                          */
/* ------------------------------------------------------------------ */

function ZirveProfili({ a }: TemaProps) {
  const el = yenidenOrnekle(a.elevation, 48);
  const min = Math.min(...el);
  const max = Math.max(...el);
  const [ust, alt] = [64, 296];
  const y = (v: number) => (max - min < 1 ? (ust + alt) / 2 : alt - ((v - min) / (max - min)) * (alt - ust));
  const x = (i: number) => (i / (el.length - 1)) * 432;
  const pts = el.map((v, i): Nokta => [x(i), y(v)]);
  const arka = [...el].reverse().map((v, i): Nokta => [x(i), alt + 4 - (alt - y(v)) * 0.62]);
  const on = egriD(pts);
  const im = el.indexOf(max);
  const [px, py] = pts[im];
  const zirve = a.maxElevationM || Math.round(max);
  const sola = px > 300;
  const SVG_UST = 540 - 92 - 300;
  return (
    <View style={{ width: 432, height: 540, backgroundColor: R.cream, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: 28, top: 28, right: 28, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Ust metin={`${buyuk(tur(a))} · ${buyuk(a.title)}`} renk={R.muted} />
          <T numberOfLines={1} style={{ fontFamily: F.baslikAgir, fontSize: 64, lineHeight: 68, letterSpacing: -2.5, color: R.ink, marginTop: 8 }}>
            ↑ {a.climbM} {mUnit()}
          </T>
          <T style={{ fontFamily: F.govde, fontSize: 14, color: R.muted, marginTop: 2 }}>{$t('paylasimTemalari.boyunca_tirmanis', { km: a.distanceKm })}</T>
        </View>
        <Logo boyut={16} renk={R.ink} />
      </View>
      <Svg width={432} height={300} style={{ position: 'absolute', left: 0, top: SVG_UST }}>
        <Path d={`${egriD(arka)} L432 300 L0 300 Z`} fill="#E4D9C3" />
        <Path d={`${on} L432 300 L0 300 Z`} fill={R.terra} />
        <Path d={on} fill="none" stroke={R.ink} strokeWidth={2} />
        <Line x1={px} y1={py - 8} x2={px} y2={18} stroke={R.ink} strokeWidth={1.5} />
        <Circle cx={px} cy={py} r={5} fill={R.cream} stroke={R.ink} strokeWidth={2} />
      </Svg>
      <View style={[{ position: 'absolute', top: SVG_UST + 12 }, sola ? { right: 432 - px + 8, alignItems: 'flex-end' } : { left: px + 8 }]}>
        <T style={{ fontFamily: F.baslik, fontSize: 16, color: R.ink }}>
          {zirve} {mUnit()}
        </T>
        <T style={{ fontFamily: F.govde, fontSize: 11, color: R.muted }}>{$t('paylasimTemalari.en_yuksek')}</T>
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 92, backgroundColor: R.ink, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 28, gap: 8 }}>
        <Hucreler liste={degerler(a, ['mesafe', 'sure', 'inis', 'ort', 'maks'], 4)} etiket={R.mutedDark} deger={R.cream} boyut={18} />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* 03 Kartpostal (kare)                                                */
/* ------------------------------------------------------------------ */

function Kartpostal({ a, route }: TemaProps) {
  const { pts } = izNoktalari(route, { x: 4, y: 4, w: 70, h: 48 });
  const kisiler = birlikteAdlar(a);
  const ozet = yukseklikVar(a) ? $t('paylasimTemalari.kartpostal_ozet', { km: a.distanceKm, m: a.climbM }) : $t('paylasimTemalari.kartpostal_ozet_duz', { km: a.distanceKm });
  const ikinci = hizVar(a) ? `${$t('paylasimKarti.maks')} ${a.maxSpeed} ${$t('paylasimTemalari.kmsa')}` : yukseklikVar(a) ? `${$t('ortak.tirmanis')} ${a.climbM} ${mUnit()}` : a.durationTotal;
  const satir = { borderBottomWidth: 1, borderBottomColor: '#C9BFAE', paddingBottom: 4 };
  // Başlık kelime ortasından bölünmesin: en uzun kelime ~179 pt'lik sütuna sığacak boyut
  const selam = $t('paylasimTemalari.selamlar');
  const enUzun = Math.max(...selam.split(/\s+/).map((k) => k.length));
  const selamBoyut = Math.min(40, Math.floor(179 / (enUzun * 0.6)));
  return (
    <View style={{ width: 480, height: 480, backgroundColor: R.sea, overflow: 'hidden' }}>
      <View
        style={{
          position: 'absolute',
          left: 40,
          top: 52,
          width: 400,
          height: 376,
          backgroundColor: R.surf,
          borderRadius: 6,
          transform: [{ rotate: '-3deg' }],
          shadowColor: '#000',
          shadowOpacity: 0.22,
          shadowRadius: 15,
          shadowOffset: { width: 0, height: 14 },
          elevation: 10,
          padding: 26,
          flexDirection: 'row',
          gap: 20,
        }}>
        <View style={{ flex: 1, justifyContent: 'space-between' }}>
          <View>
            <T numberOfLines={3} style={{ fontFamily: F.baslikAgir, fontSize: selamBoyut, lineHeight: selamBoyut, letterSpacing: -0.03 * selamBoyut, color: R.sea }}>
              {selam}
            </T>
            <T numberOfLines={5} style={{ marginTop: 16, fontFamily: F.govde, fontStyle: 'italic', fontSize: 13, lineHeight: 19.5, color: '#2E3631' }}>
              {a.title}. {ozet}
            </T>
          </View>
          <T numberOfLines={2} style={{ fontFamily: F.govdeYari, fontSize: 12, color: R.muted }}>
            {kisiler.length ? `— ${kisiler.join(', ')}` : ''}
          </T>
        </View>
        <View style={{ width: 1, backgroundColor: R.line }} />
        <View style={{ width: 128, gap: 14 }}>
          <View style={{ width: 96, height: 116, alignSelf: 'flex-end', backgroundColor: R.terra, padding: 3, borderWidth: 3, borderStyle: 'dotted', borderColor: R.surf, justifyContent: 'space-between' }}>
            <Svg width={78} height={56}>
              <Path d={yolD(pts)} {...yuvarlak} stroke={R.surf} strokeWidth={2.4} />
            </Svg>
            <T numberOfLines={1} style={{ fontFamily: F.baslikAgir, fontSize: 20, lineHeight: 22, color: R.surf }}>
              {a.distanceKm}
              <T style={{ fontSize: 11 }}> {buyuk(kmUnit())}</T>
            </T>
          </View>
          <View style={{ width: 110, height: 110, alignSelf: 'flex-end', marginTop: -40, marginRight: 34, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={110} height={110} style={{ position: 'absolute', left: 0, top: 0 }}>
              <Circle cx={55} cy={55} r={44} fill="none" stroke={R.sea} strokeWidth={2} opacity={0.8} />
              <Circle cx={55} cy={55} r={34} fill="none" stroke={R.sea} strokeWidth={1} opacity={0.8} />
            </Svg>
            <T numberOfLines={1} style={{ maxWidth: 62, fontFamily: F.govdeKalin, fontSize: 10, color: R.sea }}>
              {buyuk(tur(a))}
            </T>
            <T numberOfLines={1} style={{ maxWidth: 66, fontFamily: F.govde, fontSize: 9, color: R.sea, marginTop: 2 }}>
              {kisaTarih(a)}
            </T>
          </View>
          <View style={{ marginTop: 'auto', gap: 10 }}>
            <T numberOfLines={1} style={[{ fontFamily: F.govde, fontSize: 12, color: R.ink }, satir]}>
              {tur(a)} · {kisaSure(a.durationMoving)}
            </T>
            <T numberOfLines={1} style={[{ fontFamily: F.govde, fontSize: 12, color: R.ink }, satir]}>
              {ikinci}
            </T>
            <View style={{ alignItems: 'flex-end' }}>
              <Logo boyut={14} renk={R.ink} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* 04 Biniş kartı (hikâye)                                             */
/* ------------------------------------------------------------------ */

/** "Kaş – Kalkan" → ["KAŞ", "KAL"]; iki parçalı değilse null */
function kodlar(baslik: string): [string, string] | null {
  const p = baslik.split(/\s+[–—-]\s+/).map((s) => s.trim());
  if (p.length !== 2 || p.some((s) => s.length < 2)) return null;
  return [buyuk(p[0].slice(0, 3)), buyuk(p[1].slice(0, 3))];
}

function BinisKarti({ a }: TemaProps) {
  const ZEMIN = '#E8E0CF';
  const k = kodlar(a.title);
  const hucreler: Deger[] = [
    { etiket: $t('ortak.mesafe'), deger: `${a.distanceKm} ${kmUnit()}` },
    { etiket: $t('paylasimTemalari.hareket'), deger: kisaSure(a.durationMoving) },
    ...(yukseklikVar(a) ? [{ etiket: $t('ortak.tirmanis'), deger: `↑ ${a.climbM} ${mUnit()}` }] : []),
    ...(hizVar(a) ? [{ etiket: $t('ortak.maks_hiz'), deger: a.maxSpeed }] : []),
    ...(hizVar(a) && a.avgSpeed !== '—' ? [{ etiket: $t('ortak.ort_hiz'), deger: a.avgSpeed }] : []),
    a.with.length > 0 ? { etiket: $t('paylasimTemalari.ekip'), deger: $t('paylasimTemalari.kisi', { n: a.with.length + 1 }) } : { etiket: $t('paylasimKarti.mola'), deger: String(a.stops.length) },
  ].slice(0, 6);
  const satirlar = [hucreler.slice(0, 2), hucreler.slice(2, 4), hucreler.slice(4, 6)].filter((s) => s.length);
  const yukseklikli = yukseklikVar(a) && a.elevation.length > 1;
  const cubuklar = yenidenOrnekle(yukseklikli ? a.elevation : a.speed, 32);
  const cmin = Math.min(...cubuklar);
  const cmax = Math.max(...cubuklar);
  const buyukYazi = { fontFamily: F.baslikAgir, fontSize: k ? 44 : 36, lineHeight: k ? 48 : 40, color: R.ink } as const;
  const kucuk = { fontFamily: F.govde, fontSize: 12, color: R.muted } as const;
  return (
    <View style={{ width: 360, height: 640, backgroundColor: ZEMIN }}>
      <View style={{ position: 'absolute', left: 28, right: 28, top: 92, bottom: 92, backgroundColor: R.surf, borderRadius: 22, overflow: 'hidden' }}>
        <View style={{ backgroundColor: R.terra, paddingVertical: 14, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Logo boyut={18} renk={R.surf} />
          <T numberOfLines={1} style={{ flexShrink: 1, marginLeft: 12, fontFamily: F.govdeKalin, fontSize: 11, letterSpacing: 1.54, color: R.surf }}>
            {buyuk($t('paylasimTemalari.kart_basligi', { tur: tur(a) }))}
          </T>
        </View>
        <View style={{ paddingTop: 16, paddingHorizontal: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View>
              <T style={buyukYazi}>{k ? k[0] : a.startClock}</T>
              <T style={kucuk}>{k ? `${$t('paylasimTemalari.kalkis')} ${a.startClock}` : $t('paylasimTemalari.kalkis')}</T>
            </View>
            <Svg width={56} height={24} style={{ marginBottom: 18 }}>
              <Path d="M2 12h48M42 5l8 7-8 7" {...yuvarlak} stroke={R.terra} strokeWidth={2.4} />
            </Svg>
            <View style={{ alignItems: 'flex-end' }}>
              <T style={buyukYazi}>{k ? k[1] : a.endClock}</T>
              <T style={kucuk}>{k ? `${$t('paylasimTemalari.varis')} ${a.endClock}` : $t('paylasimTemalari.varis')}</T>
            </View>
          </View>
          {satirlar.map((s, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              {s.map((h) => (
                <View key={h.etiket} style={{ flex: 1 }}>
                  <T numberOfLines={1} style={{ fontFamily: F.govdeYari, fontSize: 10, letterSpacing: 1, color: R.muted }}>
                    {buyuk(h.etiket)}
                  </T>
                  <T numberOfLines={1} style={{ fontFamily: F.baslik, fontSize: 20, lineHeight: 25, color: R.ink }}>
                    {h.deger}
                  </T>
                </View>
              ))}
            </View>
          ))}
        </View>
        <View style={{ marginTop: 18, height: 2 }}>
          <Svg width={304} height={2}>
            <Line x1={0} y1={1} x2={304} y2={1} stroke={R.line} strokeWidth={2} strokeDasharray="6 5" />
          </Svg>
          <View style={{ position: 'absolute', left: -14, top: -13, width: 28, height: 28, borderRadius: 14, backgroundColor: ZEMIN }} />
          <View style={{ position: 'absolute', right: -14, top: -13, width: 28, height: 28, borderRadius: 14, backgroundColor: ZEMIN }} />
        </View>
        <View style={{ marginTop: 'auto', paddingTop: 14, paddingHorizontal: 24, paddingBottom: 18 }}>
          <T numberOfLines={1} style={{ fontFamily: F.govdeYari, fontSize: 10, letterSpacing: 1, color: R.muted, marginBottom: 8 }}>
            {buyuk(yukseklikli ? $t('paylasimTemalari.yukseklik_profili') : $t('paylasimTemalari.hiz_profili'))} · {buyuk(tamTarih(a))}
          </T>
          <Svg width={256} height={58}>
            {cubuklar.map((v, i) => {
              const h = 4 + (cmax - cmin > 0 ? (v - cmin) / (cmax - cmin) : 0.5) * 52;
              return <Rect key={i} x={i * 8} y={56 - h} width={5} height={h} rx={1} fill={R.ink} />;
            })}
          </Svg>
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* 05 Minimal tipografi (gönderi)                                      */
/* ------------------------------------------------------------------ */

function MinimalTipografi({ a, route, uclariGizle }: TemaProps) {
  const { pts } = izNoktalari(route, { x: 96, y: 6, w: 240, h: 78 });
  const son = pts[pts.length - 1];
  const uzunluk = a.distanceKm.length;
  const fs = uzunluk <= 4 ? 188 : uzunluk === 5 ? 150 : 120;
  return (
    <View style={{ width: 432, height: 540, backgroundColor: R.surf, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: 32, top: 30, right: 32, flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <T numberOfLines={1} style={{ fontFamily: F.govdeYari, fontSize: 13, color: R.ink }}>
            {a.title}
          </T>
          <T numberOfLines={1} style={{ fontFamily: F.govde, fontSize: 13, color: R.muted }}>
            {tur(a)} · {gun(a)}
          </T>
        </View>
        <Logo boyut={16} renk={R.ink} />
      </View>
      <T numberOfLines={1} style={{ position: 'absolute', left: 22, right: 8, top: 288 - fs * 0.98, fontFamily: F.baslikAgir, fontSize: fs, lineHeight: fs * 1.02, letterSpacing: -0.07 * fs, color: R.ink }}>
        {a.distanceKm}
      </T>
      <T style={{ position: 'absolute', right: 34, top: 292, fontFamily: F.baslik, fontSize: 30, color: R.terra }}>{kmUnit()}</T>
      <Svg width={432} height={90} style={{ position: 'absolute', left: 0, top: 340 }}>
        <Path d={yolD(pts)} {...yuvarlak} stroke={R.terra} strokeWidth={2.5} />
        {!uclariGizle && son ? <Circle cx={son[0]} cy={son[1]} r={4} fill={R.surf} stroke={R.terra} strokeWidth={1.8} /> : null}
      </Svg>
      <View style={{ position: 'absolute', left: 32, right: 32, bottom: 32, flexDirection: 'row', gap: 8, borderTopWidth: 1.5, borderTopColor: R.ink, paddingTop: 14 }}>
        <Hucreler liste={degerler(a, ['sure', 'tirmanis', 'maks', 'ort', 'inis'], 4)} etiket={R.muted} deger={R.ink} boyut={17} />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* 06 Fotoğrafın üstünde (hikâye)                                      */
/* ------------------------------------------------------------------ */

function FotografUstu({ a, route, uclariGizle, foto }: TemaProps) {
  const { pts } = izNoktalari(route, { x: 44, y: 150, w: 272, h: 250 });
  const d = yolD(pts);
  const son = pts[pts.length - 1];
  return (
    <View style={{ width: 360, height: 640, backgroundColor: '#5E6B62', overflow: 'hidden' }}>
      {foto ? (
        <>
          <Image source={{ uri: foto }} resizeMode="cover" style={{ position: 'absolute', left: 0, top: 0, width: 360, height: 640 }} />
          <Svg width={360} height={640} style={{ position: 'absolute', left: 0, top: 0 }}>
            <Defs>
              <LinearGradient id="golge" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000" stopOpacity={0.28} />
                <Stop offset="0.3" stopColor="#000" stopOpacity={0} />
                <Stop offset="0.65" stopColor="#000" stopOpacity={0} />
                <Stop offset="1" stopColor="#000" stopOpacity={0.35} />
              </LinearGradient>
            </Defs>
            <Rect width={360} height={640} fill="url(#golge)" />
          </Svg>
        </>
      ) : (
        <>
          <Svg width={360} height={640} style={{ position: 'absolute', left: 0, top: 0 }}>
            <Defs>
              <Pattern id="tarali" width={14} height={14} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <Rect width={14} height={14} fill="#5E6B62" />
                <Line x1={0} y1={0} x2={0} y2={14} stroke="#6B786F" strokeWidth={6} />
              </Pattern>
            </Defs>
            <Rect width={360} height={640} fill="url(#tarali)" />
          </Svg>
          <View style={{ position: 'absolute', left: 0, right: 0, top: 440, alignItems: 'center', gap: 6 }}>
            <Svg width={34} height={34} viewBox="0 0 24 24">
              <Path d="M4 8h3l2-3h6l2 3h3v11H4z" fill="none" stroke="#DCE3DE" strokeWidth={1.6} strokeLinejoin="round" />
              <Circle cx={12} cy={13} r={3.5} fill="none" stroke="#DCE3DE" strokeWidth={1.6} />
            </Svg>
            <T style={{ fontFamily: F.govdeYari, fontSize: 13, color: '#DCE3DE' }}>{$t('paylasimTemalari.foto_sec')}</T>
          </View>
        </>
      )}
      <Svg width={360} height={640} style={{ position: 'absolute', left: 0, top: 0 }}>
        {d ? (
          <>
            <Path d={d} {...yuvarlak} stroke="rgba(14,21,18,0.55)" strokeWidth={10} />
            <Path d={d} {...yuvarlak} stroke="#FFFFFF" strokeWidth={4.5} />
          </>
        ) : null}
        {!uclariGizle && son ? <Circle cx={son[0]} cy={son[1]} r={6} fill={R.ink} stroke="#FFFFFF" strokeWidth={2.7} /> : null}
      </Svg>
      <View style={{ position: 'absolute', left: 20, top: 92, height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: 'rgba(14,21,18,0.78)', justifyContent: 'center' }}>
        <T style={{ fontFamily: F.govdeYari, fontSize: 12, color: '#FFFFFF' }}>{tur(a)}</T>
      </View>
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 88, borderRadius: 20, backgroundColor: 'rgba(14,21,18,0.82)', paddingVertical: 18, paddingHorizontal: 20 }}>
        <T numberOfLines={1} style={{ fontFamily: F.baslik, fontSize: 22, color: '#FFFFFF' }}>
          {a.title}
        </T>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Hucreler liste={degerler(a, ['mesafe', 'tirmanis', 'sure', 'ort'], 3)} etiket="#C9D1CB" deger="#FFFFFF" boyut={20} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
          <T style={{ fontFamily: F.govde, fontSize: 12, color: '#C9D1CB' }}>{gun(a)}</T>
          <Logo boyut={16} renk="#FFFFFF" />
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* 09 Hız haritası (hikâye)                                            */
/* ------------------------------------------------------------------ */

const HIZ_RENK = ['#F6D9A8', '#E07A4A', '#FF5A3C'] as const;

/** Hıza göre renkli parçalar + eşikler + en hızlı nokta */
function hizParcalari(a: Activity, route: LngLat[], kutu: { x: number; y: number; w: number; h: number }) {
  const { pts, idx } = izNoktalari(route, kutu);
  const ham = noktaHizlari(a, route);
  const v = idx.map((i) => ham[i] ?? 0);
  // Kısa titremeleri yumuşat (5 noktalık hareketli ortalama)
  const yumusak = v.map((_, i) => {
    const dilim = v.slice(Math.max(0, i - 2), i + 3);
    return dilim.reduce((s, x) => s + x, 0) / dilim.length;
  });
  const pozitif = ham.filter((x) => x > 0.5);
  const ort = pozitif.length ? pozitif.reduce((s, x) => s + x, 0) / pozitif.length : 0;
  const e1 = Math.max(1, Math.round(ort * 0.85));
  const e2 = Math.max(e1 + 1, Math.round(ort * 1.2));
  const kademe = (x: number) => (x < e1 ? 0 : x < e2 ? 1 : 2);
  const parcalar: { d: string; renk: string }[] = [];
  let bas = 0;
  for (let i = 1; i < pts.length; i++) {
    const k = kademe(yumusak[i]);
    const sonraki = i + 1 < pts.length ? kademe(yumusak[i + 1]) : -1;
    if (sonraki !== k) {
      parcalar.push({ d: yolD(pts.slice(bas, i + 1)), renk: HIZ_RENK[k] });
      bas = i;
    }
  }
  let enHizli = 0;
  v.forEach((x, i) => {
    if (x > v[enHizli]) enHizli = i;
  });
  return { pts, parcalar, e1, e2, enHizli: pts[enHizli] as Nokta | undefined };
}

function HizHaritasi({ a, route, uclariGizle }: TemaProps) {
  const H = 300;
  const { pts, parcalar, e1, e2, enHizli } = hizParcalari(a, route, { x: 30, y: 30, w: 300, h: 220 });
  const tum = yolD(pts);
  const son = pts[pts.length - 1];
  const asagi = enHizli ? enHizli[1] < H - 70 : true;
  const kmsa = $t('paylasimTemalari.kmsa');
  const lejant: [string, string][] = [
    [HIZ_RENK[0], `< ${e1}`],
    [HIZ_RENK[1], `${e1}–${e2}`],
    [HIZ_RENK[2], `${e2}+ ${kmsa}`],
  ];
  return (
    <View style={{ width: 360, height: 640, backgroundColor: R.night, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: 24, top: 92, right: 24, zIndex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Ust metin={`${buyuk($t('paylasimTemalari.hiz'))} · ${buyuk(a.title)}`} renk={R.mutedDark} style={{ flex: 1, marginRight: 12 }} />
        <Logo boyut={16} renk="#EDE7DB" />
      </View>
      <Svg width={360} height={H} style={{ position: 'absolute', left: 0, top: 120 }}>
        <Defs>
          <RadialGradient id="hizIsik" cx="50%" cy="50%" r="60%">
            <Stop offset="0" stopColor="#1C2722" />
            <Stop offset="1" stopColor={R.night} />
          </RadialGradient>
        </Defs>
        <Rect width={360} height={H} fill="url(#hizIsik)" />
        {tum ? (
          <>
            <Path d={tum} {...yuvarlak} stroke={R.cream} strokeOpacity={0.04} strokeWidth={46} />
            <Path d={tum} {...yuvarlak} stroke={R.night} strokeWidth={11} />
          </>
        ) : null}
        {parcalar.map((p, i) => (
          <Path key={i} d={p.d} {...yuvarlak} stroke={p.renk} strokeWidth={6} />
        ))}
        {!uclariGizle && son ? <Circle cx={son[0]} cy={son[1]} r={4} fill={R.night} stroke={HIZ_RENK[0]} strokeWidth={2} /> : null}
        {enHizli ? (
          <>
            <Line x1={enHizli[0]} y1={asagi ? enHizli[1] + 9 : enHizli[1] - 9} x2={enHizli[0]} y2={asagi ? enHizli[1] + 46 : enHizli[1] - 46} stroke="#FFFFFF" strokeWidth={1.2} />
            <Circle cx={enHizli[0]} cy={enHizli[1]} r={8} fill="none" stroke="#FFFFFF" strokeWidth={1.5} />
          </>
        ) : null}
      </Svg>
      {enHizli ? (
        <T
          numberOfLines={1}
          style={{
            position: 'absolute',
            width: 140,
            left: Math.min(360 - 150, Math.max(10, enHizli[0] - 70)),
            top: 120 + (asagi ? enHizli[1] + 48 : enHizli[1] - 70),
            textAlign: 'center',
            fontFamily: F.baslik,
            fontSize: 14,
            color: '#FFFFFF',
          }}>
          {a.maxSpeed} {kmsa}
        </T>
      ) : null}
      <View style={{ position: 'absolute', left: 24, right: 24, top: 432, flexDirection: 'row', gap: 16 }}>
        {lejant.map(([renk, metin]) => (
          <View key={renk} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 18, height: 6, borderRadius: 3, backgroundColor: renk }} />
            <T style={{ fontFamily: F.govde, fontSize: 12, color: '#EDE7DB' }}>{metin}</T>
          </View>
        ))}
      </View>
      <View style={{ position: 'absolute', left: 24, right: 24, bottom: 90, flexDirection: 'row', gap: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: R.lineDark }}>
        {[
          { etiket: $t('paylasimKarti.maks'), deger: a.maxSpeed, renk: '#FF8A6E' },
          { etiket: $t('paylasimKarti.ort'), deger: a.avgSpeed, renk: '#EDE7DB' },
          { etiket: $t('ortak.mesafe'), deger: a.distanceKm, renk: '#EDE7DB' },
        ].map((d) => (
          <View key={d.etiket} style={{ flex: 1 }}>
            <T style={{ fontFamily: F.govdeOrta, fontSize: 11, color: R.mutedDark }}>{d.etiket}</T>
            <T numberOfLines={1} style={{ fontFamily: F.baslik, fontSize: 26, lineHeight: 32, color: d.renk }}>
              {d.deger}
            </T>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* 10 Günün akışı (hikâye)                                             */
/* ------------------------------------------------------------------ */

type Satir = { saat: string; baslik: string; alt: string; tip: 'bas' | 'mola' | 'son'; n?: string };

function GununAkisi({ a }: TemaProps) {
  const gosterilen = a.stops.length > 4 ? a.stops.slice(0, 3) : a.stops;
  const kalan = a.stops.length - gosterilen.length;
  const satirlar: Satir[] = [
    { saat: a.startClock, baslik: $t('paylasimTemalari.baslangic'), alt: '', tip: 'bas' },
    ...gosterilen.map(
      (s): Satir => ({
        saat: s.time,
        baslik: s.note.trim() || s.title,
        alt: $t('paylasimTemalari.mola_alt', { km: s.km, sure: kisaSure(s.duration) }),
        tip: 'mola',
        n: String(s.n),
      }),
    ),
    ...(kalan > 0 ? [{ saat: '', baslik: $t('paylasimTemalari.daha_mola', { n: kalan }), alt: '', tip: 'mola' as const, n: '+' }] : []),
    { saat: a.endClock, baslik: $t('paylasimTemalari.bitis'), alt: '', tip: 'son' },
  ];
  const yukseklik = Math.min(66, 284 / satirlar.length);
  return (
    <View style={{ width: 360, height: 640, backgroundColor: R.cream, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: 28, right: 28, top: 92 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Ust metin={`${buyuk($t('paylasimTemalari.akis'))} · ${buyuk(gun(a))}`} renk={R.muted} style={{ flex: 1, marginRight: 12 }} />
          <Logo boyut={16} renk={R.ink} />
        </View>
        <T numberOfLines={1} style={{ fontFamily: F.baslikAgir, fontSize: 30, lineHeight: 34, color: R.ink, marginTop: 8 }}>
          {a.title}
        </T>
        <T numberOfLines={1} style={{ fontFamily: F.govde, fontSize: 14, color: R.muted, marginTop: 4 }}>
          {$t('paylasimTemalari.akis_ozet', { toplam: kisaSure(a.durationTotal), hareket: kisaSure(a.durationMoving) })} · {$t('paylasimTemalari.mola_sayisi', { n: a.stops.length })}
        </T>
      </View>
      <View style={{ position: 'absolute', left: 28, right: 28, top: 196 }}>
        {satirlar.map((s, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 12, height: yukseklik }}>
            <T style={{ width: 46, fontFamily: F.baslik, fontSize: 15, color: R.ink, paddingTop: 4 }}>{s.saat}</T>
            <View style={{ width: 26, alignItems: 'center' }}>
              {s.tip === 'mola' ? (
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: R.ink, alignItems: 'center', justifyContent: 'center' }}>
                  <T style={{ fontFamily: F.govdeKalin, fontSize: 12, color: R.surf }}>{s.n}</T>
                </View>
              ) : (
                <View style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: s.tip === 'bas' ? R.terra : R.ink, backgroundColor: R.surf }} />
                </View>
              )}
              {i < satirlar.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: R.line, marginVertical: 4 }} /> : null}
            </View>
            <View style={{ flex: 1, paddingTop: 3 }}>
              <T numberOfLines={1} style={{ fontFamily: F.govdeYari, fontSize: 15, color: R.ink }}>
                {s.baslik}
              </T>
              {s.alt ? (
                <T numberOfLines={1} style={{ fontFamily: F.govde, fontSize: 12, color: R.muted, marginTop: 2 }}>
                  {s.alt}
                </T>
              ) : null}
            </View>
          </View>
        ))}
      </View>
      <View style={{ position: 'absolute', left: 28, right: 28, bottom: 90, backgroundColor: R.ink, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 18, flexDirection: 'row', gap: 8 }}>
        <Hucreler liste={degerler(a, ['mesafe', 'tirmanis', 'maks', 'ort', 'sure'], 3)} etiket={R.mutedDark} deger={R.cream} boyut={18} />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Katalog                                                             */
/* ------------------------------------------------------------------ */

const izVar = (a: Activity) => a.route.length > 1;

export const PAYLASIM_TEMALARI: Tema[] = [
  { id: 'gece', ad: () => $t('paylasimTemalari.gece'), bicim: 'hikaye', zemin: R.night, uygun: izVar, Bilesen: GeceHaritasi },
  { id: 'foto', ad: () => $t('paylasimTemalari.foto'), bicim: 'hikaye', zemin: R.night, uygun: () => true, Bilesen: FotografUstu },
  {
    id: 'zirve',
    ad: () => $t('paylasimTemalari.zirve'),
    bicim: 'gonderi',
    zemin: R.cream,
    uygun: (a) => yukseklikVar(a) && a.elevation.length > 1 && Math.max(...a.elevation) - Math.min(...a.elevation) >= 1,
    Bilesen: ZirveProfili,
  },
  { id: 'minimal', ad: () => $t('paylasimTemalari.minimal'), bicim: 'gonderi', zemin: R.surf, uygun: () => true, Bilesen: MinimalTipografi },
  { id: 'binis', ad: () => $t('paylasimTemalari.binis'), bicim: 'hikaye', zemin: '#E8E0CF', uygun: () => true, Bilesen: BinisKarti },
  { id: 'kartpostal', ad: () => $t('paylasimTemalari.kartpostal'), bicim: 'kare', zemin: R.sea, uygun: () => true, Bilesen: Kartpostal },
  { id: 'akis', ad: () => $t('paylasimTemalari.akis'), bicim: 'hikaye', zemin: R.cream, uygun: () => true, Bilesen: GununAkisi },
  { id: 'hiz', ad: () => $t('paylasimTemalari.hiz'), bicim: 'hikaye', zemin: R.night, uygun: (a) => izVar(a) && hizVar(a) && (a.speed.some((v) => v > 0) || !!a.hizProfili?.length), Bilesen: HizHaritasi },
];

/** Temayı yakalanacak kök görünümle çizer. `hikaye`: gönderi / kare biçimli kart 9:16 zeminin ortasına yerleşir */
export function TemaGorseli({ tema, hikaye, ref, ...p }: TemaProps & { tema: Tema; hikaye?: boolean; ref?: Ref<HostInstance> }) {
  const o = BICIM_OLCU[tema.bicim];
  const B = tema.Bilesen;
  const etiket = $t('paylasimTemalari.erisim', { ad: tema.ad(), title: p.a.title, km: p.a.distanceKm });
  if (!hikaye || tema.bicim === 'hikaye') {
    return (
      <View ref={ref} collapsable={false} accessible accessibilityLabel={etiket} style={{ width: o.w, height: o.h }}>
        <B {...p} />
      </View>
    );
  }
  return (
    <View ref={ref} collapsable={false} accessible accessibilityLabel={etiket} style={{ width: 360, height: 640, backgroundColor: tema.zemin, justifyContent: 'center' }}>
      <Olcekli w={o.w} h={o.h} s={360 / o.w}>
        <B {...p} />
      </Olcekli>
    </View>
  );
}
