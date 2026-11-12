import { describe, expect, it } from 'vitest';

import { gunesBatmisMi, gunesYuksekligi } from './gunes';

const istanbul = [28.98, 41.01] as const;
const batmis = (iso: string, [lng, lat]: readonly [number, number] = istanbul) => gunesBatmisMi(new Date(iso), lng, lat);

describe('güneşin yüksekliği', () => {
  // Türkiye yıl boyu UTC+3: İstanbul'da güneş öğlesi ~12:50
  it('İstanbul, 13 Kasım: gün doğumu ~07:55, batımı ~17:40 (UTC+3)', () => {
    expect(batmis('2026-11-13T04:40:00Z')).toBe(true); // 07:40
    expect(batmis('2026-11-13T05:10:00Z')).toBe(false); // 08:10
    expect(batmis('2026-11-13T14:25:00Z')).toBe(false); // 17:25
    expect(batmis('2026-11-13T15:00:00Z')).toBe(true); // 18:00
  });

  it('İstanbul, 21 Haziran: gün batımı ~20:40', () => {
    expect(batmis('2026-06-21T17:15:00Z')).toBe(false); // 20:15
    expect(batmis('2026-06-21T18:05:00Z')).toBe(true); // 21:05
  });

  it('öğlen güneş yüksekte, gece yarısı ufkun altında', () => {
    // Güneş öğlesi 09:48 UTC; 41° enlemde Kasım ortasında güneş ~31° yükselir
    expect(gunesYuksekligi(new Date('2026-11-13T09:48:00Z'), ...istanbul)).toBeGreaterThan(30);
    expect(gunesYuksekligi(new Date('2026-11-13T09:48:00Z'), ...istanbul)).toBeLessThan(32);
    expect(gunesYuksekligi(new Date('2026-11-13T21:00:00Z'), ...istanbul)).toBeLessThan(-40);
  });

  it('güney yarıkürede mevsim tersine: Sidney, 21 Haziran 17:30 yerelde gece', () => {
    expect(batmis('2026-06-21T07:30:00Z', [151.21, -33.87])).toBe(true); // 17:30 UTC+10
    expect(batmis('2026-12-21T07:30:00Z', [151.21, -33.87])).toBe(false); // 18:30 UTC+11
  });
});
