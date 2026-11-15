'use client';

/**
 * Canlı konum haritası (MapLibre GL, uygulamayla aynı OpenFreeMap stili): iz çizgisi ve şimdiki konum.
 * Kütüphane sayfa açıldıktan sonra yüklenir. İlk açılışta iz sığdırılır; sonra konum görünen alanın dışına
 * çıkarsa harita oraya kayar (kullanıcı yakınlaştırmışsa yakınlığı korunur).
 */
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoJSONSource, Map as HaritaNesnesi } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';

import styles from './canli.module.css';

const STIL = 'https://tiles.openfreemap.org/styles/liberty';

type Props = { konum: [number, number]; iz: [number, number, number][]; etiket: string };

function izVerisi(iz: [number, number, number][], konum: [number, number]) {
  const noktalar = iz.map((p) => [p[0], p[1]] as [number, number]);
  return {
    cizgi: { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: noktalar.length > 1 ? noktalar : [konum, konum] } },
    ben: { type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: konum } },
  };
}

export function CanliHarita({ konum, iz, etiket }: Props) {
  const kutu = useRef<HTMLDivElement>(null);
  const harita = useRef<HaritaNesnesi | null>(null);
  const [hazir, setHazir] = useState(false);
  const ilkVeri = useRef({ konum, iz });

  // Harita bir kez kurulur
  useEffect(() => {
    let iptal = false;
    void import('maplibre-gl').then(({ Map: Harita, NavigationControl, LngLatBounds }) => {
      if (iptal || !kutu.current) return;
      const { konum: k, iz: z } = ilkVeri.current;
      const h = new Harita({ container: kutu.current, style: STIL, center: k, zoom: 14, attributionControl: { compact: true } });
      h.addControl(new NavigationControl({ showCompass: false }), 'top-right');
      h.on('load', () => {
        const v = izVerisi(z, k);
        h.addSource('iz', { type: 'geojson', data: v.cizgi });
        h.addSource('ben', { type: 'geojson', data: v.ben });
        h.addLayer({ id: 'iz-kenar', type: 'line', source: 'iz', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FBF8F2', 'line-width': 7 } });
        h.addLayer({ id: 'iz-cizgi', type: 'line', source: 'iz', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#0B6A6A', 'line-width': 4 } });
        h.addLayer({ id: 'ben-hale', type: 'circle', source: 'ben', paint: { 'circle-radius': 18, 'circle-color': '#B04E25', 'circle-opacity': 0.18 } });
        h.addLayer({ id: 'ben', type: 'circle', source: 'ben', paint: { 'circle-radius': 8, 'circle-color': '#B04E25', 'circle-stroke-color': '#FBF8F2', 'circle-stroke-width': 3 } });
        if (z.length > 1) {
          const b = new LngLatBounds(k, k);
          z.forEach((p) => b.extend([p[0], p[1]]));
          h.fitBounds(b, { padding: 48, maxZoom: 16, duration: 0 });
        }
        setHazir(true);
      });
      harita.current = h;
    });
    return () => {
      iptal = true;
      harita.current?.remove();
      harita.current = null;
    };
  }, []);

  // Yeni veri gelince çizgiyi ve konumu güncelle; konum görünmüyorsa oraya kay
  useEffect(() => {
    const h = harita.current;
    if (!hazir || !h) return;
    const v = izVerisi(iz, konum);
    (h.getSource('iz') as GeoJSONSource | undefined)?.setData(v.cizgi);
    (h.getSource('ben') as GeoJSONSource | undefined)?.setData(v.ben);
    if (!h.getBounds().contains(konum)) h.easeTo({ center: konum, duration: 600 });
  }, [hazir, konum, iz]);

  return <div ref={kutu} className={styles.harita} role="img" aria-label={etiket} />;
}
