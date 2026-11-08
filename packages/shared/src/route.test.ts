import { describe, expect, it } from 'vitest';

import { estimateDifficulty, estimateDuration, prepareRoute, routeStats, trackOnRoute, type RoutePoint } from './route';

const O = { lat: 36.2, lng: 29.6 };
const M_LAT = 1 / 111195;
const M_LNG = 1 / (111195 * Math.cos((O.lat * Math.PI) / 180));
const at = (northM: number, eastM: number, alt?: number): RoutePoint => ({ lat: O.lat + northM * M_LAT, lng: O.lng + eastM * M_LNG, alt });

/** 1 km kuzeye düz çizgi, 100 m aralıklı */
const line = prepareRoute(Array.from({ length: 11 }, (_, i) => at(i * 100, 0)));

/** 400 m × 400 m kare döngü: kuzey → doğu → güney → batı, başladığı yerde biter */
const square = prepareRoute([at(0, 0), at(400, 0), at(400, 400), at(0, 400), at(0, 0)]);

describe('trackOnRoute', () => {
  it('düz rotada ortadaki nokta ≈ yarı yol', () => {
    const p = trackOnRoute(line, at(500, 0));
    expect(p.totalM).toBeCloseTo(1000, -1);
    expect(p.doneM).toBeCloseTo(500, -1);
    expect(p.remainingM).toBeCloseTo(500, -1);
    expect(p.offRouteM).toBeLessThan(2);
  });

  it('noktalar arasında da hassas (izdüşüm)', () => {
    expect(trackOnRoute(line, at(250, 10)).doneM).toBeCloseTo(250, -1);
  });

  it('rotadan sapmayı ölçer', () => {
    const p = trackOnRoute(line, at(500, 120));
    expect(p.offRouteM).toBeGreaterThan(110);
    expect(p.offRouteM).toBeLessThan(130);
  });

  it('döngü rotasının başında ilerleme 0 olur, sona atlamaz', () => {
    const p = trackOnRoute(square, at(5, 3));
    expect(p.doneM).toBeLessThan(20);
  });

  it('döngüde sona yaklaşınca önceki konumla doğru ilerler', () => {
    let prev = trackOnRoute(square, at(0, 0));
    // kare boyunca 50 m adımlarla yürü
    const path: RoutePoint[] = [];
    for (let n = 50; n <= 400; n += 50) path.push(at(n, 0));
    for (let e = 50; e <= 400; e += 50) path.push(at(400, e));
    for (let n = 350; n >= 0; n -= 50) path.push(at(n, 400));
    for (let e = 350; e >= 10; e -= 50) path.push(at(0, e));
    for (const p of path) prev = trackOnRoute(square, p, prev);
    // son nokta bitişe 50 m kala
    expect(prev.doneM).toBeCloseTo(1550, -1);
    expect(prev.remainingM).toBeCloseTo(50, -1);
  });

  it('kısa bir geri dönüşte ilerleme makul kalır', () => {
    const a = trackOnRoute(line, at(600, 0));
    const b = trackOnRoute(line, at(560, 0), a);
    expect(b.doneM).toBeCloseTo(560, -1);
  });
});

describe('routeStats', () => {
  it('mesafe, tırmanış ve döngü', () => {
    const pts = Array.from({ length: 41 }, (_, i) => at(i * 50, 0, i <= 20 ? i * 10 : 200 - (i - 20) * 10));
    const s = routeStats(pts);
    expect(s.distanceM).toBeCloseTo(2000, -1);
    expect(Math.abs(s.gainM - 200)).toBeLessThan(25);
    expect(Math.abs(s.lossM - 200)).toBeLessThan(25);
    expect(s.isLoop).toBe(false);
    expect(routeStats(square.points).isLoop).toBe(true);
  });
});

describe('estimateDuration', () => {
  it('düz 10 km yürüyüş ≈ 2 sa 13 dk', () => {
    expect(estimateDuration('walk', 10000, 0) / 60).toBeCloseTo(133, -1);
  });
  it('600 m tırmanış doğa yürüyüşüne ≈ 1 saat ekler', () => {
    expect((estimateDuration('hike', 10000, 600) - estimateDuration('hike', 10000, 0)) / 3600).toBeCloseTo(1, 1);
  });
});

describe('estimateDifficulty', () => {
  it('kısa düz yürüyüş kolay, uzun dik yürüyüş zor', () => {
    expect(estimateDifficulty('walk', 5000, 50)).toBe('easy');
    expect(estimateDifficulty('hike', 18000, 900)).toBe('hard');
  });
  it('bisiklette ölçek farklı', () => {
    expect(estimateDifficulty('bike', 20000, 150)).toBe('easy');
    expect(estimateDifficulty('walk', 20000, 150)).toBe('hard');
  });
});
