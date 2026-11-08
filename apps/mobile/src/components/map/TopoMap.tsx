/**
 * Lykiva haritası.
 *
 * - Geliştirme derlemesinde (dev build) ve mağaza sürümünde MapLibre ile gerçek OSM haritası çizer.
 * - Expo Go'da MapLibre'nin yerel modülü olmadığı için tasarımdaki stilize SVG haritaya düşer;
 *   böylece uygulama Expo Go'da da denenebilir.
 *
 * Harita stili EXPO_PUBLIC_MAP_STYLE_URL ile değiştirilir (ör. MapTiler Outdoor).
 * Varsayılan: OpenFreeMap Liberty (anahtarsız, OSM verisi).
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { LngLat } from '@/data/ornek';
import { FallbackMap } from './FallbackMap';

export type MapMarker = {
  id: string;
  coord: LngLat;
  kind: 'start' | 'end' | 'stop' | 'me' | 'friend' | 'meeting';
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
  /** Haritaya dokununca (yalnızca gerçek haritada) */
  onPress?: (coord: LngLat) => void;
  accessibilityLabel: string;
};

export const MAP_STYLE_URL = process.env.EXPO_PUBLIC_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';

// Expo Go ve web'de MapLibre'nin yerel modülü yok → stilize SVG harita
const useFallback = Constants.executionEnvironment === ExecutionEnvironment.StoreClient || Platform.OS === 'web';

/** Gerçek (MapLibre) harita mı — Expo Go ve web'de değil */
export const gercekHarita = !useFallback;

export function TopoMap(props: TopoMapProps) {
  return (
    <View
      style={[styles.root, props.style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={props.accessibilityLabel}>
      {useFallback ? <FallbackMap {...props} /> : <NativeMap {...props} />}
    </View>
  );
}

function NativeMap(props: TopoMapProps) {
  // Yerel modül yalnızca burada yüklenir; Expo Go bu satıra hiç gelmez.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ML = require('@maplibre/maplibre-react-native') as typeof import('@maplibre/maplibre-react-native');
  const { route = [], progress, markers = [], interactive = true, padding } = props;
  const pts = route.length ? route : markers.map((m) => m.coord);
  const bounds = boundsOf(pts);
  const split = progress !== undefined ? Math.max(1, Math.round(progress * (route.length - 1))) : route.length - 1;
  const done = route.slice(0, split + 1);
  const rest = route.slice(split);

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
      mapStyle={MAP_STYLE_URL}
      logo={false}
      compass={false}
      scaleBar={false}
      attribution
      dragPan={interactive}
      touchZoom={interactive}
      doubleTapZoom={interactive}
      touchRotate={false}
      touchPitch={false}
      onPress={props.onPress ? (e) => props.onPress?.([e.nativeEvent.lngLat[0], e.nativeEvent.lngLat[1]]) : undefined}>
      {props.follow ? (
        <ML.Camera center={props.follow} zoom={props.followZoom ?? 16} duration={800} padding={{ top: 0, right: 0, left: 0, bottom: 0, ...padding }} />
      ) : bounds ? (
        <ML.Camera
          initialViewState={{
            bounds,
            padding: { top: 60, right: 40, bottom: 40, left: 40, ...padding },
          }}
        />
      ) : null}

      {done.length > 1 ? (
        <ML.GeoJSONSource id="rota-tamam" data={lineOf(done)}>
          <ML.Layer
            id="rota-tamam-kenar"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': props.dark ? '#0E1512' : '#FBF8F2', 'line-width': 8 }}
          />
          <ML.Layer
            id="rota-tamam-cizgi"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': props.dark ? '#E07A4A' : '#B04E25', 'line-width': 4.5 }}
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
              'circle-radius': ['match', ['get', 'kind'], 'stop', 10, 'me', 9, 7],
              'circle-color': [
                'match',
                ['get', 'kind'],
                'start',
                '#FBF8F2',
                'meeting',
                '#0B6A6A',
                'me',
                props.dark ? '#E07A4A' : '#0B6A6A',
                '#16201B',
              ],
              'circle-stroke-color': ['match', ['get', 'kind'], 'start', '#0B6A6A', '#FBF8F2'],
              'circle-stroke-width': ['match', ['get', 'kind'], 'start', 3, 2.5],
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
});
