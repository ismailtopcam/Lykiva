/**
 * Kulüp (grup) sayfasındaki "Haftalık" sekmesi: bu haftanın (Pazartesi'den, Türkiye saati) kulüp toplamı,
 * gün gün mesafe, geçen haftayla karşılaştırma ve üye sıralaması. Hesap sunucuda (grup_haftalik_istatistik);
 * yalnızca bakan kişinin görebildiği, "yalnızca ben" olmayan aktiviteler sayılır.
 */
import { formatKm, formatMeters, formatPercent, kmUnit, mUnit } from '@lykiva/shared';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Txt } from '@/components/Txt';
import { Avatar, SectionHeader } from '@/components/ui';
import { basHarfler, grupHaftalikIstatistik, grupRengi, type HaftalikIstatistik as Istatistik } from '@/grup/gruplar';
import { colors, fontFamily, space, temaliStil } from '@/theme';
import { $t, yerel } from '@/i18n';

const GUN = 86_400_000;

/** 5400 → "1:30" (saat:dakika) */
function saatDakika(sn: number) {
  const dk = Math.round(sn / 60);
  return `${Math.floor(dk / 60)}:${String(dk % 60).padStart(2, '0')}`;
}

export function HaftalikIstatistik({ grupId }: { grupId: string }) {
  const [v, setV] = useState<Istatistik | null | undefined>(undefined);
  const [simdi, setSimdi] = useState(0);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    let acik = true;
    grupHaftalikIstatistik(grupId)
      .then((x) => {
        if (!acik) return;
        setV(x);
        setSimdi(Date.now());
        setHata(null);
      })
      .catch((e: unknown) => {
        if (!acik) return;
        setHata(e instanceof Error ? e.message : $t('ortak.yuklenemedi'));
        setV(null);
      });
    return () => {
      acik = false;
    };
  }, [grupId]);

  if (v === undefined) return <ActivityIndicator color={colors.terra} style={{ marginVertical: space.lg }} />;
  if (!v) return <Txt variant="muted">{hata ?? $t('ortak.yuklenemedi')}</Txt>;

  const bas = Date.parse(v.hafta_basi);
  const tarih = (t: number, ay = true) => new Date(t).toLocaleDateString(yerel(), ay ? { day: 'numeric', month: 'short' } : { day: 'numeric' });
  const aralik = `${tarih(bas, false)}–${tarih(bas + 6 * GUN)}`;
  const bugun = simdi ? Math.min(6, Math.max(0, Math.floor((simdi - bas) / GUN))) : -1;
  const enCok = Math.max(...v.gunler, 1);

  const fark = v.gecen_hafta_mesafe_m > 0 ? Math.round(((v.mesafe_m - v.gecen_hafta_mesafe_m) / v.gecen_hafta_mesafe_m) * 100) : null;
  const karsilastirma =
    fark === null
      ? v.mesafe_m > 0
        ? $t('kulup.gecen_hafta_yok')
        : null
      : $t('kulup.gecen_haftaya_gore', { fark: `${fark >= 0 ? '+' : '−'}${formatPercent(Math.abs(fark))}` });

  const kutular: { ad: string; deger: string; birim?: string }[] = [
    { ad: $t('ortak.mesafe'), deger: formatKm(v.mesafe_m), birim: kmUnit() },
    { ad: $t('ortak.sure'), deger: saatDakika(v.sure_s), birim: $t('ortak.birim_sa') },
    { ad: $t('ortak.tirmanis'), deger: formatMeters(v.tirmanis_m), birim: mUnit() },
    { ad: $t('kulup.aktivite'), deger: String(v.aktivite) },
  ];

  return (
    <View style={{ gap: space.md }}>
      <View>
        <Txt variant="label">{$t('kulup.bu_hafta', { aralik })}</Txt>
        <Txt variant="small" style={{ marginTop: 2 }}>
          {$t('kulup.aktif_uye', { aktif: v.aktif_uye, uye: v.uye_sayisi })}
          {karsilastirma ? ` · ${karsilastirma}` : ''}
        </Txt>
      </View>

      <View style={styles.kutular}>
        {kutular.map((k) => (
          <View key={k.ad} style={styles.kutu} accessible accessibilityLabel={`${k.ad}: ${k.deger} ${k.birim ?? ''}`}>
            <Txt variant="small">{k.ad}</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <Txt style={styles.deger}>{k.deger}</Txt>
              {k.birim ? <Txt variant="small">{k.birim}</Txt> : null}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.grafik} accessibilityLabel={$t('kulup.gunluk')}>
        {v.gunler.map((m, i) => (
          <View key={i} style={styles.sutun} accessible accessibilityLabel={`${new Date(bas + i * GUN).toLocaleDateString(yerel(), { weekday: 'long' })}: ${formatKm(m)} ${kmUnit()}`}>
            <View style={styles.cubukAlan}>
              <View style={[styles.cubuk, { height: `${Math.max(m > 0 ? 6 : 2, (m / enCok) * 100)}%` }, i === bugun ? { backgroundColor: colors.terra } : m > 0 ? null : { backgroundColor: colors.lineStrong }]} />
            </View>
            <Txt variant="small" style={i === bugun ? { fontFamily: fontFamily.bodyBold, color: colors.ink } : undefined}>
              {new Date(bas + i * GUN).toLocaleDateString(yerel(), { weekday: 'narrow' })}
            </Txt>
          </View>
        ))}
      </View>

      <SectionHeader title={$t('kulup.siralama')} />
      {v.siralama.length === 0 ? (
        <Txt variant="muted">{$t('kulup.siralama_bos')}</Txt>
      ) : (
        v.siralama.map((u, i) => (
          <View key={u.user_id} style={[styles.satir, u.ben && { backgroundColor: colors.seaSoft }]}>
            <Txt style={styles.sira}>{i + 1}</Txt>
            <Avatar initials={basHarfler(u.display_name)} tone={grupRengi(u.user_id)} size={36} uri={u.avatar_url} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14 }} numberOfLines={1}>
                {u.display_name}
                {u.ben ? $t('grup.sen') : ''}
              </Txt>
              <Txt variant="small">{$t('kulup.satir', { sure: saatDakika(u.sure_s), birim: $t('ortak.birim_sa'), n: u.aktivite })}</Txt>
            </View>
            <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 15 }}>
              {formatKm(u.mesafe_m)} {kmUnit()}
            </Txt>
          </View>
        ))
      )}
      <Txt variant="small">{$t('kulup.gorunurluk_notu')}</Txt>
    </View>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  kutular: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  kutu: { width: '49%', padding: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: 2 },
  deger: { fontFamily: fontFamily.displayHeavy, fontSize: 24, letterSpacing: -0.4 },
  grafik: { flexDirection: 'row', gap: 6, height: 120, padding: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  sutun: { flex: 1, alignItems: 'center', gap: 4 },
  cubukAlan: { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  cubuk: { width: '70%', maxWidth: 22, borderRadius: 6, backgroundColor: colors.sea },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 12 },
  sira: { width: 22, textAlign: 'center', fontFamily: fontFamily.bodyBold, fontSize: 14, color: colors.inkMuted },
}));
