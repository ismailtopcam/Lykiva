/**
 * Rota detayında "Çevrimdışı kullan": rotanın çevresini telefona indirir, ilerlemeyi gösterir, siler.
 * Expo Go / web'de (gerçek harita yok) görünmez.
 */
import { formatBytes } from '@lykiva/shared';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import type { Rota } from '@/data/rota';
import { cevrimdisiDestekleniyor, cevrimdisiSil, indirmeyiIptalEt, rotaPlani, rotayiIndir, useCevrimdisiRota } from '@/lib/cevrimdisi';
import { colors, fontFamily, space } from '@/theme';
import { Icon } from './Icon';
import { Txt } from './Txt';
import { Button } from './ui';

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
    Alert.alert('Çevrimdışı haritayı sil', 'Bu rotanın telefona indirilen haritası silinsin mi? Rota silinmez.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
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
        <Txt style={styles.baslik}>{d.durum === 'hazir' ? 'Çevrimdışı hazır' : 'Çevrimdışı kullan'}</Txt>
      </View>

      {d.durum === 'yok' ? (
        <>
          <Txt variant="small">
            {plan.fits
              ? 'Rotayı ve iki yanındaki 1 km’lik haritayı telefona indir; çekmeyen yerde de harita ve rota açılır.'
              : 'Bu rota çevrimdışı indirme için çok uzun. Daha kısa parçalara bölüp kaydedersen indirebilirsin.'}
          </Txt>
          {plan.fits ? <Button variant="outline" icon="download" label="Haritayı indir" onPress={() => void indir()} style={{ marginTop: 10 }} /> : null}
        </>
      ) : d.durum === 'iniyor' ? (
        <View style={styles.satir}>
          <ActivityIndicator color={colors.terra} />
          <Txt style={{ flex: 1, fontSize: 14 }} accessibilityLabel={`İndiriliyor, yüzde ${d.yuzde}`}>
            İndiriliyor… %{d.yuzde}
          </Txt>
          <Pressable accessibilityRole="button" onPress={() => indirmeyiIptalEt(rota.id)} hitSlop={10}>
            <Txt style={styles.baglanti}>Vazgeç</Txt>
          </Pressable>
        </View>
      ) : d.durum === 'hazir' ? (
        <View style={styles.satir}>
          <Txt variant="small" style={{ flex: 1 }}>
            {formatBytes(d.kayit.bayt)} · {new Date(d.kayit.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} tarihinde indirildi
          </Txt>
          <Pressable accessibilityRole="button" accessibilityLabel="Çevrimdışı haritayı güncelle" onPress={() => void indir()} hitSlop={10} disabled={mesgul}>
            <Txt style={styles.baglanti}>Güncelle</Txt>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Çevrimdışı haritayı sil" onPress={silmeyiSor} hitSlop={10} disabled={mesgul}>
            <Txt style={[styles.baglanti, { color: colors.terra }]}>Sil</Txt>
          </Pressable>
        </View>
      ) : (
        <>
          <Txt variant="small" accessibilityRole="alert" style={{ color: colors.terra }}>
            {d.mesaj}
          </Txt>
          <Button variant="outline" icon="download" label="Tekrar dene" onPress={() => void indir()} style={{ marginTop: 10 }} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  kart: { marginTop: 14, padding: space.md, borderRadius: 14, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface },
  ust: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  baslik: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  baglanti: { fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: colors.sea },
});
