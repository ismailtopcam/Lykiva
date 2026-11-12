/**
 * Lykiva haritası.
 *
 * - Geliştirme derlemesinde (dev build) ve mağaza sürümünde MapLibre ile gerçek OSM haritası çizer.
 * - Expo Go'da MapLibre'nin yerel modülü olmadığı için tasarımdaki stilize SVG haritaya düşer;
 *   böylece uygulama Expo Go'da da denenebilir.
 *
 * Harita türü (standart, uydu, hibrit, kış) kullanıcının seçimidir: bkz. haritaTurleri.ts.
 * Standart stil EXPO_PUBLIC_MAP_STYLE_URL ile değiştirilir (ör. MapTiler Outdoor).
 * Varsayılan: OpenFreeMap Liberty (anahtarsız, OSM verisi).
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { LngLat } from '@/data/ornek';
import { FallbackMap } from './FallbackMap';
import { HaritaTuruDugmesi } from './HaritaTuruSecici';
import { GECE_STIL_URL, MAP_STYLE_URL, useHaritaStili } from './haritaTurleri';
import { ISI_RENKLERI, useIsiTuru, useIsiVerisi, type Gorunum } from './isiHaritasi';

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
   * [from, to] (ikisi dahil) ve rengi. progress ile birlikte kullanılmaz. Yalnızca gerçek haritada.
   */
  routeColors?: { from: number; to: number; color: string }[];
  markers?: MapMarker[];
  dark?: boolean;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Kamera kenar boşluğu (alttaki panel için alt boşluğu artır) */
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
  /** Verilirse kamera bu konumu takip eder (kayıt sırasında) */
  follow?: LngLat | null;
  /** follow için yakınlaştırma (varsayılan 16) */
  followZoom?: number;
  /** 3B görünüm: kamera eğilir, gece stilinde binalar yükseltilir. Yalnızca gerçek haritada. */
  ucBoyut?: boolean;
  /** Kullanıcı haritayı elle kaydırınca / yakınlaştırınca (ör. takibi bırakmak için) */
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
  return (
    <View style={[styles.root, props.style]}>
      <View style={StyleSheet.absoluteFill} accessible accessibilityRole="image" accessibilityLabel={props.accessibilityLabel}>
        {useFallback ? <FallbackMap {...props} /> : <NativeMap {...props} />}
      </View>
      {props.katmanDugmesi && !useFallback ? (
        <HaritaTuruDugmesi koyu={props.dark} style={[styles.katman, { top: props.katmanDugmesi.top }]} />
      ) : null}
    </View>
  );
}

function NativeMap(props: TopoMapProps) {
  // Yerel modül yalnızca burada yüklenir; Expo Go bu satıra hiç gelmez.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ML = require('@maplibre/maplibre-react-native') as typeof import('@maplibre/maplibre-react-native');
  const mapStyle = useHaritaStili(props.dark);
  const isiTuru = useIsiTuru();
  const [gorunum, setGorunum] = useState<Gorunum | null>(null);
  const isi = useIsiVerisi(isiTuru, gorunum);
  const { route = [], progress, markers = [], interactive = true, padding } = props;
  const egim = props.ucBoyut ? 60 : 0;
  const pts = route.length ? route : markers.map((m) => m.coord);
  const bounds = boundsOf(pts);
  const split = progress !== undefined ? Math.max(1, Math.round(progress * (route.length - 1))) : route.length - 1;
  const done = route.slice(0, split + 1);
  const rest = route.slice(split);
  const renkli =
    progress === undefined && props.routeColors?.length && route.length > 1
      ? {
          type: 'FeatureCollection' as const,
          features: props.routeColors
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
      compass={false}
      scaleBar={false}
      attribution
      dragPan={interactive}
      touchZoom={interactive}
      doubleTapZoom={interactive}
      touchRotate={false}
      touchPitch={false}
      onPress={props.onPress ? (e) => props.onPress?.([e.nativeEvent.lngLat[0], e.nativeEvent.lngLat[1]]) : undefined}
      onRegionWillChange={
        props.onKullaniciOynatti
          ? (e) => {
              if (e.nativeEvent.userInteraction) props.onKullaniciOynatti?.();
            }
          : undefined
      }
      // Görünen alan hep izlenir: ısı haritası sonradan açılınca haritayı kımıldatmadan veri gelsin
      onRegionDidChange={(e) => {
        const { bounds, zoom } = e.nativeEvent;
        setGorunum({ bounds: [bounds[0], bounds[1], bounds[2], bounds[3]], zoom });
      }}>
      {props.follow ? (
        <ML.Camera
          center={props.follow}
          zoom={props.followZoom ?? 16}
          pitch={egim}
          duration={800}
          padding={{ top: 0, right: 0, left: 0, bottom: 0, ...padding }}
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
        // Gece stilinde binalar düz; 3B'de yükseltilir (standart stilde zaten var). Yazıların altında.
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
            paint={{ 'line-color': props.dark ? '#0E1512' : '#FBF8F2', 'line-width': 8 }}
          />
          {renkli ? null : (
            <ML.Layer
              id="rota-tamam-cizgi"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': props.dark ? '#E07A4A' : '#B04E25', 'line-width': 4.5 }}
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
            paint={{ 'line-color': ['get', 'c'], 'line-width': 4.5 }}
          />
        </ML.GeoJSONSource>
      ) : null}

      {progress !== undefined && rest.length > 1 ? (
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
                props.dark ? '#E07A4A' : '#0B6A6A',
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
