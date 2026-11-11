import { describe, expect, it } from 'vitest';

import { acceptPoint, computeSegmentedStats, computeStats, currentSpeed, detectStops, haversine, routeProgress, staleAfterS, thin, type TrackPoint } from './track';

const START = { lat: 36.2, lng: 29.6 };
/** Kuzeye doğru 1 m ≈ bu kadar enlem */
const DEG_PER_M = 1 / 111195;

/** 1 sn aralıklı yapay iz: hareket (5 m/s) → mola (120 sn) → hareket; rakım 0→100→40 */
function synthetic(stopS = 120): TrackPoint[] {
  const pts: TrackPoint[] = [];
  let t = 0;
  let northM = 0;
  const push = (alt: number, speed: number) => pts.push({ t: t * 1000, lat: START.lat + northM * DEG_PER_M, lng: START.lng, alt, acc: 5, speed });
  for (let s = 0; s < 300; s++) {
    push((s / 300) * 100, 5);
    northM += 5;
    t++;
  }
  for (let s = 0; s < stopS; s++) {
    push(100, 0);
    t++;
  }
  for (let s = 0; s <= 300; s++) {
    push(100 - (s / 300) * 60, 5);
    northM += 5;
    t++;
  }
  return pts;
}

describe('haversine', () => {
  it('1 derece enlem ≈ 111,2 km', () => {
    expect(haversine({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111195, -1);
  });
});

describe('acceptPoint', () => {
  const a: TrackPoint = { t: 0, lat: 36.2, lng: 29.6, acc: 5 };
  it('kötü doğruluğu eler', () => expect(acceptPoint(a, { ...a, t: 1000, acc: 80 })).toBe(false));
  it('zamanda geri gideni eler', () => expect(acceptPoint(a, { ...a, t: 0 })).toBe(false));
  it('imkânsız sıçramayı eler (1 sn’de 1 km)', () => expect(acceptPoint(a, { ...a, t: 1000, lat: a.lat + 1000 * DEG_PER_M })).toBe(false));
  it('normal noktayı kabul eder', () => expect(acceptPoint(a, { ...a, t: 1000, lat: a.lat + 5 * DEG_PER_M })).toBe(true));
});

describe('computeStats', () => {
  const s = computeStats(synthetic());
  it('mesafe ≈ 3000 m', () => expect(Math.abs(s.distanceM - 3000)).toBeLessThan(30));
  it('hareket süresi molayı içermez (≈ 600 sn)', () => expect(Math.abs(s.movingS - 600)).toBeLessThan(5));
  it('toplam süre molayı içerir (≈ 720 sn)', () => expect(Math.abs(s.elapsedS - 720)).toBeLessThan(2));
  it('ortalama hareket hızı ≈ 5 m/s', () => expect(s.avgMovingSpeed).toBeCloseTo(5, 1));
  it('maks. hız ≈ 5 m/s', () => expect(s.maxSpeed).toBeCloseTo(5, 1));
  it('tırmanış ≈ 100 m, iniş ≈ 60 m', () => {
    expect(Math.abs(s.gainM - 100)).toBeLessThan(4);
    expect(Math.abs(s.lossM - 60)).toBeLessThan(4);
  });
  it('rakım gürültüsü (±3 m) tırmanış eklemez', () => {
    const noisy: TrackPoint[] = Array.from({ length: 200 }, (_, i) => ({ t: i * 1000, lat: START.lat + i * 4 * DEG_PER_M, lng: START.lng, alt: 50 + (i % 2 ? 3 : -3), speed: 4 }));
    expect(computeStats(noisy).gainM).toBe(0);
  });
  it('tek GPS sıçraması maks. hızı bozmaz', () => {
    const pts = synthetic();
    pts[100] = { ...pts[100], speed: 45 };
    expect(computeStats(pts).maxSpeed).toBeLessThan(6);
  });
});

describe('detectStops', () => {
  it('120 sn’lik molayı bulur', () => {
    const stops = detectStops(synthetic());
    expect(stops).toHaveLength(1);
    expect((stops[0].endT - stops[0].startT) / 1000).toBeGreaterThanOrEqual(115);
    expect(Math.abs(stops[0].distanceAtM - 1500)).toBeLessThan(30);
  });
  it('kısa duraklamayı mola saymaz', () => {
    expect(detectStops(synthetic(30))).toHaveLength(0);
  });
});

describe('thin', () => {
  it('ilk ve son noktayı korur, yoğunluğu azaltır', () => {
    const pts = synthetic();
    const out = thin(pts, 20);
    expect(out[0]).toBe(pts[0]);
    expect(out[out.length - 1]).toBe(pts[pts.length - 1]);
    expect(out.length).toBeLessThan(pts.length / 3);
  });
});

describe('routeProgress', () => {
  it('rotanın ortasında ≈ yarısı tamamlanmış', () => {
    const route = Array.from({ length: 11 }, (_, i) => ({ lat: START.lat + i * 100 * DEG_PER_M, lng: START.lng }));
    const p = routeProgress(route, { lat: START.lat + 500 * DEG_PER_M, lng: START.lng });
    expect(p.totalM).toBeCloseTo(1000, -1);
    expect(p.doneM).toBeCloseTo(500, -1);
    expect(p.remainingM).toBeCloseTo(500, -1);
  });
});

describe('computeSegmentedStats', () => {
  it('duraklatma sırasında gidilen yolu saymaz', () => {
    const pts = synthetic(0);
    const a = pts.slice(0, 300);
    // duraklatmadayken 2 km "araçla" gidilmiş gibi: ikinci parça 2 km kuzeyden başlar
    const b = pts.slice(300).map((p) => ({ ...p, t: p.t + 600_000, lat: p.lat + 2000 * DEG_PER_M }));
    const s = computeSegmentedStats([a, b]);
    expect(Math.abs(s.distanceM - 3000)).toBeLessThan(30);
    expect(Math.abs(s.elapsedS - 1200)).toBeLessThan(3);
    expect(Math.abs(s.movingS - 600)).toBeLessThan(5);
  });
  it('boş parçalarla çökmez', () => {
    expect(computeSegmentedStats([[], []]).distanceM).toBe(0);
  });
});

describe('currentSpeed', () => {
  /** 1 sn aralıklı, kuzeye giden iz; her saniyenin hızı (m/s) verilir, cihaz hızı isteğe bağlı */
  function iz(hizlar: number[], cihazHizi = true): TrackPoint[] {
    let northM = 0;
    return hizlar.map((v, i) => {
      northM += v;
      return { t: i * 1000, lat: START.lat + northM * DEG_PER_M, lng: START.lng, acc: 5, speed: cihazHizi ? v : null };
    });
  }

  it('son saniyelerdeki hızı verir', () => {
    expect(currentSpeed(synthetic())).toBeCloseTo(5, 1);
  });

  it('boş izde 0', () => expect(currentSpeed([])).toBe(0));

  it('hızlanmayı bir saniye içinde yakalar (uzun pencerenin gecikmesi yok)', () => {
    // 5 sn 4 m/s, sonra 8 m/s: eski 5 sn'lik medyan hâlâ 4 derdi
    const p = iz([4, 4, 4, 4, 4, 8, 8]);
    expect(currentSpeed(p)).toBe(8);
  });

  it('tek bir sıçramayı bastırır', () => {
    expect(currentSpeed(iz([5, 5, 5, 25, 5]))).toBe(5);
  });

  it('cihaz hızı "duruyor" deyince hemen 0', () => {
    expect(currentSpeed(iz([6, 6, 6, 3, 0.2]))).toBe(0);
  });

  it('cihaz hızı yoksa konum farkından', () => {
    expect(currentSpeed(iz([5, 5, 5, 5, 5, 5, 5], false))).toBeCloseTo(5, 1);
  });

  it('geçersiz cihaz hızında (-1, iOS) konum farkına döner', () => {
    const p = iz([4, 4, 4, 4, 4, 4]).map((x) => ({ ...x, speed: -1 }));
    expect(currentSpeed(p)).toBeCloseTo(4, 1);
  });

  it('yeni nokta gelmeyince (durdu) bisiklet hızında 3 sn sonra 0', () => {
    const p = iz([6, 6, 6, 6]);
    const son = p[p.length - 1].t;
    expect(currentSpeed(p, son + 2000)).toBe(6);
    expect(currentSpeed(p, son + 3500)).toBe(0);
  });

  it("yürüyüşte noktalar seyrek gelir: bekleme süresi uzar, ama 10 sn'yi geçmez", () => {
    // 1,2 m/s'te 3 m için ~2,5 sn → 2×2,5+1 = 6 sn beklenir
    expect(staleAfterS(1.2)).toBeCloseTo(6, 5);
    expect(staleAfterS(6)).toBe(3);
    expect(staleAfterS(0.6)).toBe(10);
    const p = iz([1.2, 1.2, 1.2]);
    const son = p[p.length - 1].t;
    expect(currentSpeed(p, son + 4000)).toBe(1.2);
    expect(currentSpeed(p, son + 7000)).toBe(0);
  });
});
