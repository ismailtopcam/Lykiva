import { describe, expect, it } from 'vitest';

import { formatGrade, gradeAt, gradeClass, gradeSegments, gradeSummary, positionAt, profileSamples, routeProfile } from './egim';
import type { RoutePoint } from './route';

const START = { lat: 36.2, lng: 29.6 };
/** Kuzeye doğru 1 m ≈ bu kadar enlem */
const DEG_PER_M = 1 / 111195;

/** Kuzeye giden, `aralik` metrede bir noktası olan rota */
function rota(alts: (number | null)[], aralik = 10): RoutePoint[] {
  return alts.map((alt, i) => ({ lat: START.lat + i * aralik * DEG_PER_M, lng: START.lng, alt }));
}

/** [uzunluk (m), eğim (%)] parçalarından yükseklik dizisi; 100 m'den başlar */
function egri(parcalar: [number, number][], aralik = 10): number[] {
  let z = 100;
  const out = [z];
  for (const [uzunluk, egim] of parcalar) {
    for (let m = aralik; m <= uzunluk; m += aralik) {
      z += (egim / 100) * aralik;
      out.push(z);
    }
  }
  return out;
}

describe('routeProfile', () => {
  it('rakım hiç yoksa null (serbest çizim)', () => {
    expect(routeProfile(rota([null, null, null]))).toBeNull();
  });
  it('eksik rakımları doldurur, mesafeyi biriktirir', () => {
    const p = routeProfile(rota([100, null, 120]))!;
    expect(p.alt).toEqual([100, 110, 120]);
    expect(p.totalM).toBeCloseTo(20, 1);
  });
});

describe('gradeClass', () => {
  it('sınırlar', () => {
    expect(gradeClass(-3)).toBe('down');
    expect(gradeClass(-2.9)).toBe('flat');
    expect(gradeClass(2.9)).toBe('flat');
    expect(gradeClass(3)).toBe('gentle');
    expect(gradeClass(6)).toBe('moderate');
    expect(gradeClass(10)).toBe('steep');
  });
});

describe('gradeAt', () => {
  const p = routeProfile(rota(egri([[1000, 5]])))!;
  it('sabit eğimde her yerde aynı, uçlarda da', () => {
    expect(gradeAt(p, 0)).toBeCloseTo(5, 1);
    expect(gradeAt(p, 500)).toBeCloseTo(5, 1);
    expect(gradeAt(p, 1000)).toBeCloseTo(5, 1);
  });
  it('rota pencereden kısaysa tamamına bakar', () => {
    const k = routeProfile(rota([100, 102, 104]))!;
    expect(gradeAt(k, 10)).toBeCloseTo(20, 0);
  });
});

describe('gradeSegments', () => {
  it('düz → dik çıkış → iniş; aynı sınıflar birleşir', () => {
    const p = routeProfile(rota(egri([[500, 0], [500, 8], [500, -5]])))!;
    const s = gradeSegments(p);
    expect(s[0].cls).toBe('flat');
    expect(s.some((x) => x.cls === 'moderate')).toBe(true);
    expect(s[s.length - 1].cls).toBe('down');
    // Geçişlerde ara sınıflar olabilir ama parçalar birleşmiş olmalı
    expect(s.length).toBeLessThanOrEqual(6);
    expect(s[0].from).toBe(0);
    expect(s[s.length - 1].to).toBe(p.d.length - 1);
  });
});

describe('gradeSummary', () => {
  it('en dik çıkış / iniş ve tırmanış bölümü', () => {
    const p = routeProfile(rota(egri([[500, 0], [500, 8], [500, -5]])))!;
    const g = gradeSummary(p);
    expect(g.maxClimbGrade).toBeCloseTo(8, 0);
    expect(g.maxDescentGrade).toBeCloseTo(5, 0);
    expect(g.byClass.moderate).toBeGreaterThan(400);
    expect(g.byClass.moderate).toBeLessThan(600);
    expect(g.climbs).toHaveLength(1);
    const c = g.climbs[0];
    expect(c.gainM).toBeCloseTo(40, 0);
    expect(c.startM).toBeCloseTo(500, -2);
    expect(c.lengthM).toBeGreaterThan(450);
    expect(c.lengthM).toBeLessThan(550);
    expect(c.avgGrade).toBeCloseTo(8, 0);
  });

  it('küçük gürültü tırmanış sayılmaz', () => {
    const p = routeProfile(rota(Array.from({ length: 200 }, (_, i) => 100 + (i % 2 ? 1 : -1))))!;
    const g = gradeSummary(p);
    expect(g.climbs).toHaveLength(0);
    expect(g.maxClimbGrade).toBeLessThan(3);
  });

  it('arada belirgin iniş varsa iki tırmanış, küçük bir düşüş tırmanışı bölmez', () => {
    const iki = gradeSummary(routeProfile(rota(egri([[400, 8], [300, -10], [400, 8]])))!);
    expect(iki.climbs).toHaveLength(2);
    const tek = gradeSummary(routeProfile(rota(egri([[400, 8], [50, -10], [400, 8]])))!);
    expect(tek.climbs).toHaveLength(1);
    expect(tek.climbs[0].gainM).toBeCloseTo(59, 0);
  });

  it('kısa ya da az kazançlı çıkış tırmanış sayılmaz', () => {
    // 150 m'de %10 → 15 m kazanç
    expect(gradeSummary(routeProfile(rota(egri([[300, 0], [150, 10], [300, 0]])))!).climbs).toHaveLength(0);
  });
});

describe('profileSamples', () => {
  it('eşit aralıklı örnekler ve aralık sınıfları', () => {
    const p = routeProfile(rota(egri([[500, 0], [500, 8]])))!;
    const s = profileSamples(p, 11);
    expect(s.d).toHaveLength(11);
    expect(s.cls).toHaveLength(10);
    expect(s.d[1] - s.d[0]).toBeCloseTo(s.d[10] - s.d[9], 6);
    expect(s.cls[0]).toBe('flat');
    expect(s.cls[9]).toBe('moderate');
  });
});

describe('positionAt', () => {
  it('rota ortasındaki konum', () => {
    const pts = rota([0, 0, 0]);
    const p = routeProfile(pts.map((x) => ({ ...x, alt: 0 })))!;
    const m = positionAt(pts, p, 10);
    expect(m.lat).toBeCloseTo(pts[1].lat, 7);
  });
});

describe('formatGrade', () => {
  it('Türkçe ondalık, işaretsiz', () => {
    expect(formatGrade(7.46)).toBe('%7,5');
    expect(formatGrade(-5)).toBe('%5');
  });
});
