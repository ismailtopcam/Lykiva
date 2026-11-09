/**
 * Bağlantı önizleme görseli (WhatsApp, Telegram, X…): rota + başlık + temel değerler.
 */
import { ACTIVITY_LABELS, colors, formatDuration, formatKm, formatMeters } from '@lykiva/shared';
import { ImageResponse } from 'next/og';

import { baslik, izCiz, paylasilanAktivite } from '@/lib/paylasim';

export const alt = 'Lykiva aktivitesi';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ anahtar: string }> }) {
  const { anahtar } = await params;
  const s = await paylasilanAktivite(anahtar);
  const a = s.durum === 'var' ? s.a : null;
  const iz = a?.track && a.track.length > 1 ? izCiz(a.track, 520, 550, 40) : null;
  const degerler: [string, string][] = a
    ? [
        [`${formatKm(a.distance_m)} km`, 'Mesafe'],
        [formatDuration(a.moving_time_s), 'Süre'],
        [`${formatMeters(Math.round(a.elevation_gain_m ?? 0))} m`, 'Tırmanış'],
      ]
    : [];

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: colors.ground, color: colors.ink }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '56px 48px 56px 64px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <svg width="44" height="44" viewBox="0 0 32 32">
              <path d="M6 28V14C6 8 11 4 16 3c5 1 10 5 10 11v14" fill="none" stroke={colors.terra} strokeWidth="2.8" strokeLinecap="round" />
              <path d="M11 28c0-6 3-9 5-13 2 4 5 7 5 13" fill="none" stroke={colors.sea} strokeWidth="2.8" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>lykiva</span>
          </div>
          {a ? (
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto' }}>
              <span style={{ fontSize: 28, color: colors.inkMuted }}>
                {a.owner_name} · {ACTIVITY_LABELS[a.activity]}
              </span>
              <span style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.05, marginTop: 8, letterSpacing: -1.5 }}>{baslik(a).slice(0, 60)}</span>
              <div style={{ display: 'flex', gap: 40, marginTop: 36 }}>
                {degerler.map(([v, l]) => (
                  <div key={l} style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 22, color: colors.inkMuted }}>{l}</span>
                    <span style={{ fontSize: 44, fontWeight: 800 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <span style={{ fontSize: 56, fontWeight: 800, marginTop: 'auto' }}>Rotanı kaydet. Birlikte yol al.</span>
          )}
        </div>
        <div style={{ width: 520, height: 550, margin: 40, marginLeft: 0, display: 'flex', borderRadius: 32, background: colors.land, overflow: 'hidden' }}>
          {iz ? (
            <svg width="520" height="550" viewBox="0 0 520 550">
              <path d={iz.d} fill="none" stroke="#FFFFFF" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
              <path d={iz.d} fill="none" stroke={colors.terra} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={iz.bas[0]} cy={iz.bas[1]} r="12" fill="#FFFFFF" stroke={colors.sea} strokeWidth="5" />
              <circle cx={iz.son[0]} cy={iz.son[1]} r="12" fill={colors.ink} stroke="#FFFFFF" strokeWidth="4" />
            </svg>
          ) : null}
        </div>
      </div>
    ),
    size,
  );
}
