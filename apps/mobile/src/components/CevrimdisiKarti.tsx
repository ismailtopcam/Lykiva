/**
 * Rota detayında "Çevrimdışı kullan": rotanın çevresini telefona indirir, ilerlemeyi gösterir, siler.
 * Expo Go / web'de (gerçek harita yok) görünmez.
 */
import { formatBytes } from '@lykiva/shared';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import type { Rota } from '@/data/rota';
import { cevrimdisiDestekleniyor, cevrimdisiSil, indirmeyiIptalEt, rotaPlani, rotayiIndir, useCevrimdisiRota } from '@/lib/cevrimdisi';
import { colors, fontFamily, space, temaliStil } from '@/theme';
import { Icon } from './Icon';
import { Txt } from './Txt';
import { Button } from './ui';
import { $t, yerel } from '@/i18n';

export function CevrimdisiKarti({ rota }: { rota: Rota }) {
  const d = useCevrimdisiRota(rota.id);
  const plan = useMemo(() => rotaPlani(rota), [rota]);
  const [mesgul, setMesgul] = useState(false);

  if (!cevrimdisiDestekleniyor || rota.points.length < 2) return null;

  async function indir() {
    // Hata durumu useCevrimdisiRota'da görünür; burada yalnızca yutulur
    await rotayiIndir(rota).catch(() => undefined);
  }

  function silmeyiSor() {
    Alert.alert($t('cevrimdisiKarti.cevrimdisi_haritayi_sil'), $t('cevrimdisiKarti.bu_rotanin_telefona_indirilen'), [
      { text: $t('ortak.vazgec'), style: 'cancel' },
      {
        text: $t('ortak.sil'),
        style: 'destructive',
        onPress: () => {
          setMesgul(true);
          void cevrimdisiSil(rota.id).finally(() => setMesgul(false));
        },
      },
    ]);
  }

  return (
    <View style={styles.kart} accessibilityLiveRegion="polite">
      <View style={styles.ust}>
        <Icon name="download" size={20} color={d.durum === 'hazir' ? colors.sea : colors.ink} />
        <Txt style={styles.baslik}>{d.durum === 'hazir' ? $t('cevrimdisiKarti.cevrimdisi_hazir') : $t('cevrimdisiKarti.cevrimdisi_kullan')}</Txt>
      </View>

      {d.durum === 'yok' ? (
        <>
          <Txt variant="small">
            {plan.fits
              ? $t('cevrimdisiKarti.rotayi_ve_iki_yanindaki')
              : $t('cevrimdisiKarti.bu_rota_cevrimdisi_indirme')}
          </Txt>
          {plan.fits ? <Button variant="outline" icon="download" label={$t('cevrimdisiKarti.haritayi_indir')} onPress={() => void indir()} style={{ marginTop: 10 }} /> : null}
        </>
      ) : d.durum === 'iniyor' ? (
        <View style={styles.satir}>
          <ActivityIndicator color={colors.terra} />
          <Txt style={{ flex: 1, fontSize: 14 }} accessibilityLabel={$t('cevrimdisiKarti.indiriliyor_yuzde', { yuzde: d.yuzde })}>
            {$t('cevrimdisiKarti.indiriliyor', { yuzde: d.yuzde })}</Txt>
          <Pressable accessibilityRole="button" onPress={() => indirmeyiIptalEt(rota.id)} hitSlop={10}>
            <Txt style={styles.baglanti}>{$t('cevrimdisiKarti.vazgec')}</Txt>
          </Pressable>
        </View>
      ) : d.durum === 'hazir' ? (
        <View style={styles.satir}>
          <Txt variant="small" style={{ flex: 1 }}>
            {$t('cevrimdisiKarti.tarihinde_indirildi', { bytes: formatBytes(d.kayit.bayt), a: new Date(d.kayit.tarih).toLocaleDateString(yerel(), { day: 'numeric', month: 'long' }) })}</Txt>
          <Pressable accessibilityRole="button" accessibilityLabel={$t('cevrimdisiKarti.cevrimdisi_haritayi_guncelle')} onPress={() => void indir()} hitSlop={10} disabled={mesgul}>
            <Txt style={styles.baglanti}>{$t('cevrimdisiKarti.guncelle')}</Txt>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={$t('cevrimdisiKarti.cevrimdisi_haritayi_sil')} onPress={silmeyiSor} hitSlop={10} disabled={mesgul}>
            <Txt style={[styles.baglanti, { color: colors.terra }]}>{$t('cevrimdisiKarti.sil')}</Txt>
          </Pressable>
        </View>
      ) : (
        <>
          <Txt variant="small" accessibilityRole="alert" style={{ color: colors.terra }}>
            {d.mesaj}
          </Txt>
          <Button variant="outline" icon="download" label={$t('cevrimdisiKarti.tekrar_dene')} onPress={() => void indir()} style={{ marginTop: 10 }} />
        </>
      )}
    </View>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  kart: { marginTop: 14, padding: space.md, borderRadius: 14, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface },
  ust: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  baslik: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  baglanti: { fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: colors.sea },
}));
