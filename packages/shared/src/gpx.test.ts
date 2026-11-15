import { describe, expect, it } from 'vitest';

import { gpxOku, rotaSadelestir } from './gpx';

const IZ = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Garmin Connect" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Üst bilgi adı</name><time>2026-11-01T07:00:00Z</time></metadata>
  <wpt lat="36.3" lon="29.7"><name>Çeşme</name></wpt>
  <trk>
    <name><![CDATA[Kaş – Kaputaş & geri]]></name>
    <type>cycling</type>
    <trkseg>
      <trkpt lat="36.2000" lon="29.6000"><ele>10.5</ele><time>2026-11-01T07:00:00Z</time></trkpt>
      <trkpt lon="29.6010" lat="36.2005"><ele>12</ele><time>2026-11-01T07:00:10Z</time></trkpt>
      <trkpt lat='36.2010' lon='29.6020'><time>2026-11-01T07:00:20Z</time></trkpt>
    </trkseg>
    <trkseg>
      <trkpt lat="36.2100" lon="29.6100"><ele>30</ele><time>2026-11-01T07:10:00Z</time></trkpt>
      <trkpt lat="36.2110" lon="29.6110"/>
      <trkpt lat="999" lon="29.6"><time>2026-11-01T07:11:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe('gpxOku', () => {
  it('izi parçalarıyla, rakım ve zamanla okur; ara noktaları ve bozuk noktayı atlar', () => {
    const g = gpxOku(IZ);
    expect(g.parcalar.map((p) => p.length)).toEqual([3, 2]);
    expect(g.parcalar[0][0]).toEqual({ lat: 36.2, lng: 29.6, alt: 10.5, t: Date.parse('2026-11-01T07:00:00Z') });
    expect(g.parcalar[0][1].lng).toBe(29.601);
    expect(g.parcalar[0][2].alt).toBeNull();
    expect(g.parcalar[1][1]).toEqual({ lat: 36.211, lng: 29.611, alt: null, t: null });
  });

  it('adı (CDATA, varlıklar) ve türü okur', () => {
    const g = gpxOku(IZ);
    expect(g.ad).toBe('Kaş – Kaputaş & geri');
    expect(g.tur).toBe('bike');
  });

  it('bir noktada zaman yoksa aktivite sayılmaz', () => {
    expect(gpxOku(IZ).zamanli).toBe(false);
    const tam = IZ.replace('<trkpt lat="36.2110" lon="29.6110"/>', '');
    expect(gpxOku(tam).zamanli).toBe(true);
  });

  it('zaman geri giderse aktivite sayılmaz', () => {
    const geri = IZ.replace('<trkpt lat="36.2110" lon="29.6110"/>', '').replace('2026-11-01T07:10:00Z', '2026-11-01T06:00:00Z');
    expect(gpxOku(geri).zamanli).toBe(false);
  });

  it('iz yoksa rotayı (rte) okur, ad metadata ya da rotadan', () => {
    const g = gpxOku(`<gpx><metadata><name>Komoot rotası</name></metadata><rte><name>Likya Yolu 3. gün</name><type>Hiking</type>
      <rtept lat="36.5" lon="29.1"><ele>200</ele></rtept><rtept lat="36.51" lon="29.11"/></rte></gpx>`);
    expect(g.parcalar).toHaveLength(1);
    expect(g.parcalar[0]).toHaveLength(2);
    expect(g.ad).toBe('Likya Yolu 3. gün');
    expect(g.tur).toBe('hike');
    expect(g.zamanli).toBe(false);
  });

  it('bilinmeyen tür boş, nokta yoksa boş liste', () => {
    const g = gpxOku('<gpx><trk><name>Boş</name><type>kayaking</type><trkseg></trkseg></trk></gpx>');
    expect(g.tur).toBeNull();
    expect(g.parcalar).toEqual([]);
    expect(gpxOku('bu bir gpx değil').parcalar).toEqual([]);
  });
});

describe('rotaSadelestir', () => {
  const O = { lat: 36.2, lng: 29.6 };
  const M_LAT = 1 / 111195;
  const M_LNG = 1 / (111195 * Math.cos((O.lat * Math.PI) / 180));
  const at = (k: number, d: number) => ({ lat: O.lat + k * M_LAT, lng: O.lng + d * M_LNG });

  it('düz çizgide yalnızca uçlar, köşede köşe kalır', () => {
    const duz = Array.from({ length: 101 }, (_, i) => at(i * 10, 0));
    expect(rotaSadelestir(duz)).toHaveLength(2);
    const kose = [...Array.from({ length: 51 }, (_, i) => at(i * 10, 0)), ...Array.from({ length: 50 }, (_, i) => at(500, (i + 1) * 10))];
    const s = rotaSadelestir(kose);
    expect(s).toHaveLength(3);
    expect(s[1]).toEqual(at(500, 0));
  });

  it('uzun, kıvrımlı izde en fazla nokta sınırını aşmaz', () => {
    const kivrimli = Array.from({ length: 60000 }, (_, i) => at(i * 5, Math.sin(i / 40) * 60 + Math.sin(i / 7) * 4));
    const s = rotaSadelestir(kivrimli, 3, 3000);
    expect(s.length).toBeLessThanOrEqual(3000);
    expect(s.length).toBeGreaterThan(100);
    expect(s[s.length - 1]).toEqual(kivrimli[kivrimli.length - 1]);
  });

  it('nokta özelliklerini (rakım) korur', () => {
    const p = [{ ...at(0, 0), alt: 1 }, { ...at(100, 50), alt: 2 }, { ...at(200, 0), alt: 3 }];
    expect(rotaSadelestir(p).map((x) => x.alt)).toEqual([1, 2, 3]);
  });
});
