/**
 * Lykiva haritası.
 *
 * - Geliştirme derlemesinde (dev build) ve mağaza sürümünde MapLibre ile gerçek OSM haritası çizer.
 * - Expo Go'da MapLibre'nin yerel modülü olmadığı için tasarımdaki stilize SVG haritaya düşer;
 *   böylece uygulama Expo Go'da da denenebilir.
 *
 * Harita türü (standart, uydu, hibrit, kış) kullanıcının seçimidir: bkz. haritaTurleri.ts.
 * Harita gündüz açık, gün batımından sonra koyu; karanlık temada hep koyu (bkz. gunduzGece.ts). Ekrana göre değişmez.
 * Standart stil EXPO_PUBLIC_MAP_STYLE_URL ile değiştirilir (ör. MapTiler Outdoor).
 * Varsayılan: OpenFreeMap Liberty (anahtarsız, OSM verisi).
 */
import type { CameraRef } from '@maplibre/maplibre-react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { LngLat } from '@/data/ornek';
import { FallbackMap } from './FallbackMap';
import { useKoyuHarita } from './gunduzGece';
import { HaritaTuruDugmesi } from './HaritaTuruSecici';
import { GECE_STIL_URL, MAP_STYLE_URL, useHaritaStili } from './haritaTurleri';
import { ISI_RENKLERI, useIsiTuru, useIsiVerisi, type Gorunum } from './isiHaritasi';
import { ROTA_RENGI } from './stilRenkleri';

export { MAP_STYLE_URL };

export type MapMarker = {
  id: string;
  coord: LngLat;
  /** cursor: yükseklik profilinde seçilen nokta */
  kind: 'start' | 'end' | 'stop' | 'me' | 'friend' | 'meeting' | 'cursor';
  label?: string;
  /** stop için numara, friend için baş harfler */
  text?: string;
  /** Harita üzerinde özel görünüm (yalnızca friend) */
  render?: ReactNode;
};

export type TopoMapProps = {
  route?: LngLat[];
  /** 0..1 — canlı takipte tamamlanan kısım (geri kalanı kesikli) */
  progress?: number;
  /**
   * Rotanın parçalarını ayrı renklerle çizmek için (ör. eğime göre): route dizisindeki nokta aralığı
   * [from, to] (ikisi dahil) ve rengi. progress ile birlikte verilirse yalnızca kalan kısım renklenir (kesikli).
   * Yalnızca gerçek haritada.
   */
  routeColors?: { from: number; to: number; color: string }[];
  markers?: MapMarker[];
  /**
   * Ekranın kendisi koyu (ör. kayıt ekranı): haritanın üstündeki katman düğmesi koyu çizilir.
   * Haritanın rengini değiştirmez; o saatten ve görünüm ayarından gelir (gunduzGece.ts).
   */
  dark?: boolean;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Kamera kenar boşluğu (alttaki panel için alt boşluğu artır) */
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
  /** Verilirse kamera bu konumu takip eder (kayıt sırasında) */
  follow?: LngLat | null;
  /** follow için yakınlaştırma (varsayılan 16) */
  followZoom?: number;
  /** 3B görünüm: kamera eğilir, binalar yükseltilir. Yalnızca gerçek haritada. */
  ucBoyut?: boolean;
  /**
   * Kullanıcı haritayı elle kaydırınca / yakınlaştırınca (ör. takibi bırakmak için).
   * Döndürme sayılmaz: takip sürerken harita takip edilen noktanın etrafında döner, takip bırakılmaz.
   */
  onKullaniciOynatti?: () => void;
  /** Haritaya dokununca (yalnızca gerçek haritada) */
  onPress?: (coord: LngLat) => void;
  /** Sağ üstte harita türü (katman) düğmesi; top: haritanın üst kenarından uzaklık. Yalnızca gerçek haritada. */
  katmanDugmesi?: { top: number };
  accessibilityLabel: string;
};

// Expo Go ve web'de MapLibre'nin yerel modülü yok → stilize SVG harita
const useFallback = Constants.executionEnvironment === ExecutionEnvironment.StoreClient || Platform.OS === 'web';

/** Gerçek (MapLibre) harita mı — Expo Go ve web'de değil */
export const gercekHarita = !useFallback;

export function TopoMap(props: TopoMapProps) {
  const koyu = useKoyuHarita();
  return (
    <View style={[styles.root, props.style]}>
      <View style={StyleSheet.absoluteFill} accessible accessibilityRole="image" accessibilityLabel={props.accessibilityLabel}>
        {useFallback ? <FallbackMap {...props} dark={koyu} /> : <NativeMap {...props} koyu={koyu} />}
      </View>
      {props.katmanDugmesi && !useFallback ? (
        <HaritaTuruDugmesi koyu={props.dark} style={[styles.katman, { top: props.katmanDugmesi.top }]} />
      ) : null}
    </View>
  );
}

function NativeMap(props: TopoMapProps & { koyu: boolean }) {
  // Yerel modül yalnızca burada yüklenir; Expo Go bu satıra hiç gelmez.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ML = require('@maplibre/maplibre-react-native') as typeof import('@maplibre/maplibre-react-native');
  const { stil: mapStyle, koyuZemin } = useHaritaStili(props.koyu);
  const isiTuru = useIsiTuru();
  const [gorunum, setGorunum] = useState<Gorunum | null>(null);
  const isi = useIsiVerisi(isiTuru, gorunum);
  const { route = [], progress, markers = [], interactive = true, padding } = props;
  const egim = props.ucBoyut ? 60 : 0;
  const takipPadding = { top: 0, right: 0, left: 0, bottom: 0, ...padding };

  // Takip sürerken (kayıt) el hareketi: hareket bitene kadar kamera yeni konuma kaydırılmaz (hareket bölünmesin).
  // Hareket bitince yön değiştiyse döndürmedir: kamera takip edilen noktayı yeniden ortalar, harita o noktanın
  // etrafında dönmüş olur. Değişmediyse kaydırma / yakınlaştırmadır: takip bırakılır (onKullaniciOynatti).
  const kamera = useRef<CameraRef>(null);
  const hareketBasiYon = useRef<number | null>(null);
  const [sabitMerkez, setSabitMerkez] = useState<LngLat | null>(null);
  const takipMerkezi = sabitMerkez ?? props.follow;
  const pts = route.length ? route : markers.map((m) => m.coord);
  const bounds = boundsOf(pts);
  const split = progress !== undefined ? Math.max(1, Math.round(progress * (route.length - 1))) : route.length - 1;
  const done = route.slice(0, split + 1);
  const rest = route.slice(split);
  // Kayıtta (progress) tamamlanan kısım rota renginde (mor) kalır; eğim renkleri yalnızca kalan kısma
  const renkBasi = progress !== undefined ? split : 0;
  const renkli =
    props.routeColors?.length && route.length > 1
      ? {
          type: 'FeatureCollection' as const,
          features: props.routeColors
            .map((r) => ({ ...r, from: Math.max(r.from, renkBasi) }))
            .filter((r) => r.to > r.from)
            .map((r) => ({
              type: 'Feature' as const,
              properties: { c: r.color },
              geometry: { type: 'LineString' as const, coordinates: route.slice(r.from, r.to + 1) },
            })),
        }
      : null;

  const pointFeatures = markers
    .filter((m) => m.kind !== 'friend')
    .map((m) => ({
      type: 'Feature' as const,
      properties: { kind: m.kind, text: m.text ?? '' },
      geometry: { type: 'Point' as const, coordinates: m.coord },
    }));

  return (
    <ML.Map
      style={StyleSheet.absoluteFill}
      mapStyle={mapStyle}
      logo={false}
      // Pusula yalnızca harita döndürülünce görünür; dokununca kuzey yukarı döner. Katman düğmesinin solunda.
      compass={interactive}
      compassPosition={props.katmanDugmesi ? { top: props.katmanDugmesi.top + 4, right: 16 + 44 + 10 } : { top: 12, right: 12 }}
      scaleBar={false}
      attribution
      dragPan={interactive}
      touchZoom={interactive}
      doubleTapZoom={interactive}
      touchRotate={interactive}
      touchPitch={false}
      onPress={props.onPress ? (e) => props.onPress?.([e.nativeEvent.lngLat[0], e.nativeEvent.lngLat[1]]) : undefined}
      onRegionWillChange={
        props.onKullaniciOynatti
          ? (e) => {
              const { userInteraction, bearing } = e.nativeEvent;
              if (!userInteraction) return;
              if (!props.follow) {
                props.onKullaniciOynatti?.();
                return;
              }
              if (hareketBasiYon.current === null) {
                hareketBasiYon.current = bearing;
                setSabitMerkez(props.follow);
              }
            }
          : undefined
      }
      // Görünen alan hep izlenir: ısı haritası sonradan açılınca haritayı kımıldatmadan veri gelsin
      onRegionDidChange={(e) => {
        const { bounds, zoom, bearing } = e.nativeEvent;
        setGorunum({ bounds: [bounds[0], bounds[1], bounds[2], bounds[3]], zoom });
        const basYon = hareketBasiYon.current;
        if (basYon === null) return;
        hareketBasiYon.current = null;
        setSabitMerkez(null);
        if (Math.abs(aciFarki(bearing, basYon)) > 2 && props.follow) {
          kamera.current?.easeTo({
            center: props.follow,
            zoom: props.followZoom ?? 16,
            pitch: egim,
            padding: takipPadding,
            duration: 300,
          });
        } else {
          props.onKullaniciOynatti?.();
        }
      }}>
      {props.follow && takipMerkezi ? (
        <ML.Camera
          ref={kamera}
          center={takipMerkezi}
          zoom={props.followZoom ?? 16}
          pitch={egim}
          duration={800}
          padding={takipPadding}
        />
      ) : bounds ? (
        <ML.Camera
          initialViewState={{
            bounds,
            padding: { top: 60, right: 40, bottom: 40, left: 40, ...padding },
          }}
          {...(props.ucBoyut !== undefined ? { pitch: egim, duration: 500 } : null)}
        />
      ) : null}

      {props.ucBoyut && mapStyle === GECE_STIL_URL ? (
        // Yedek gece stilinde (OpenFreeMap Dark) binalar düz; 3B'de yükseltilir (standart ve türetilen gece
        // stilinde zaten var). Yazıların altında.
        <ML.Layer
          id="binalar-3b"
          type="fill-extrusion"
          source="openmaptiles"
          source-layer="building"
          minzoom={14}
          beforeId="highway_name_other"
          paint={{
            'fill-extrusion-color': '#1E2422',
            'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
            'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
            'fill-extrusion-opacity': 0.9,
          }}
        />
      ) : null}

      {isiTuru && isi ? (
        <ML.GeoJSONSource id="isi" data={isi}>
          <ML.Layer
            id="isi-katmani"
            type="heatmap"
            paint={{
              'heatmap-weight': ['get', 'w'],
              'heatmap-intensity': 1.1,
              'heatmap-radius': 9,
              'heatmap-opacity': 0.85,
              'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0,
                'rgba(0,0,0,0)',
                0.12,
                ISI_RENKLERI[isiTuru][0],
                0.35,
                ISI_RENKLERI[isiTuru][1],
                0.6,
                ISI_RENKLERI[isiTuru][2],
                0.85,
                ISI_RENKLERI[isiTuru][3],
                1,
                ISI_RENKLERI[isiTuru][4],
              ],
            }}
          />
        </ML.GeoJSONSource>
      ) : null}

      {done.length > 1 ? (
        <ML.GeoJSONSource id="rota-tamam" data={lineOf(done)}>
          <ML.Layer
            id="rota-tamam-kenar"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': koyuZemin ? '#0E1512' : '#FBF8F2', 'line-width': 8 }}
          />
          {renkli && progress === undefined ? null : (
            <ML.Layer
              id="rota-tamam-cizgi"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': koyuZemin ? ROTA_RENGI.koyu : ROTA_RENGI.acik, 'line-width': 4.5 }}
            />
          )}
        </ML.GeoJSONSource>
      ) : null}

      {renkli ? (
        <ML.GeoJSONSource id="rota-renkli" data={renkli}>
          <ML.Layer
            id="rota-renkli-cizgi"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={
              progress === undefined
                ? { 'line-color': ['get', 'c'], 'line-width': 4.5 }
                : { 'line-color': ['get', 'c'], 'line-width': 4, 'line-dasharray': [1, 1.6] }
            }
          />
        </ML.GeoJSONSource>
      ) : null}

      {progress !== undefined && !renkli && rest.length > 1 ? (
        <ML.GeoJSONSource id="rota-kalan" data={lineOf(rest)}>
          <ML.Layer
            id="rota-kalan-cizgi"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': '#6E7A73', 'line-width': 3.5, 'line-dasharray': [0.5, 2.5] }}
          />
        </ML.GeoJSONSource>
      ) : null}

      {pointFeatures.length ? (
        <ML.GeoJSONSource id="isaretler" data={{ type: 'FeatureCollection', features: pointFeatures }}>
          <ML.Layer
            id="isaret-daire"
            type="circle"
            paint={{
              'circle-radius': ['match', ['get', 'kind'], 'stop', 10, 'me', 9, 'cursor', 8, 7],
              'circle-color': [
                'match',
                ['get', 'kind'],
                'start',
                '#FBF8F2',
                'cursor',
                '#FBF8F2',
                'meeting',
                '#0B6A6A',
                'me',
                koyuZemin ? '#E07A4A' : '#0B6A6A',
                '#16201B',
              ],
              'circle-stroke-color': ['match', ['get', 'kind'], 'start', '#0B6A6A', 'cursor', '#16201B', '#FBF8F2'],
              'circle-stroke-width': ['match', ['get', 'kind'], 'start', 3, 'cursor', 3.5, 2.5],
            }}
          />
          <ML.Layer
            id="isaret-yazi"
            type="symbol"
            // Yazı tipi belirtilmezse "Open Sans" istenir; OpenFreeMap'te yok (404) ve numaralar görünmez
            layout={{ 'text-field': ['get', 'text'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-allow-overlap': true }}
            paint={{ 'text-color': '#FBF8F2' }}
          />
        </ML.GeoJSONSource>
      ) : null}

      {markers
        .filter((m) => m.kind === 'friend')
        .map((m) => (
          <ML.ViewAnnotation key={m.id} id={m.id} lngLat={m.coord} anchor="bottom">
            <View>{m.render}</View>
          </ML.ViewAnnotation>
        ))}
    </ML.Map>
  );
}

function boundsOf(pts: LngLat[]): [number, number, number, number] | null {
  if (!pts.length) return null;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const pad = 0.002;
  return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
}

/** İki yön arasındaki en kısa fark, derece (-180..180) */
function aciFarki(a: number, b: number) {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

function lineOf(coords: LngLat[]) {
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates: coords },
  };
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
  katman: { position: 'absolute', right: 16 },
});
