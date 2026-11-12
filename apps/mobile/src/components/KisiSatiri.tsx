/**
 * Kişi listesi satırı: avatar, ad, alt bilgi ve Takip et düğmesi.
 * Düğme hemen değişir (iyimser); sunucu reddederse geri döner.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { takipEt, type KisiOzeti } from '@/akis/akis';
import { Txt } from '@/components/Txt';
import { Avatar } from '@/components/ui';
import { basHarfler, grupRengi } from '@/grup/gruplar';
import { colors, fontFamily, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

export function altBilgi(k: KisiOzeti) {
  const parcalar = [`@${k.username}`];
  if (k.city) parcalar.push(k.city);
  if (k.follows_me) parcalar.push('seni takip ediyor');
  else if (k.common_groups) parcalar.push(k.common_groups === 1 ? $t('kisiSatiri.ortak_grubunuz_var') : $t('kisiSatiri.ortak_grup', { common_groups: k.common_groups }));
  return parcalar.join(' · ');
}

export function TakipDugmesi({
  kisi,
  takipte,
  geriTakip,
  onDegisti,
  genis,
}: {
  kisi: string;
  takipte: boolean;
  geriTakip?: boolean;
  onDegisti?: (takipte: boolean) => void;
  genis?: boolean;
}) {
  const [durum, setDurum] = useState(takipte);
  const [bekliyor, setBekliyor] = useState(false);
  // Üst bileşen yeni veri getirdiyse ona uy
  const [onceki, setOnceki] = useState(takipte);
  if (onceki !== takipte) {
    setOnceki(takipte);
    setDurum(takipte);
  }

  async function degistir() {
    const yeni = !durum;
    setDurum(yeni);
    setBekliyor(true);
    try {
      await takipEt(kisi, yeni);
      onDegisti?.(yeni);
    } catch {
      setDurum(!yeni);
    } finally {
      setBekliyor(false);
    }
  }

  const etiket = durum ? $t('kisiSatiri.takip_ediliyor') : geriTakip ? $t('kisiSatiri.sen_de_takip_et') : $t('kisiSatiri.takip_et');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: durum, busy: bekliyor }}
      onPress={() => void degistir()}
      disabled={bekliyor}
      style={({ pressed }) => [styles.btn, genis && styles.genis, durum ? styles.btnOn : styles.btnOff, pressed && { opacity: 0.8 }]}>
      {bekliyor ? (
        <ActivityIndicator size="small" color={durum ? colors.ink : '#FFFFFF'} />
      ) : (
        <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: genis ? 15 : 13, color: durum ? colors.ink : '#FFFFFF' }}>{etiket}</Txt>
      )}
    </Pressable>
  );
}

export function KisiSatiri({ k, onDegisti }: { k: KisiOzeti; onDegisti?: (takipte: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={$t('kisiSatiri.profili', { display_name: k.display_name })}
        onPress={() => router.push({ pathname: '/kisi/[id]', params: { id: k.id } })}
        style={styles.kisi}>
        <Avatar initials={basHarfler(k.display_name)} tone={grupRengi(k.id)} size={44} uri={k.avatar_url} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
            {k.display_name}
          </Txt>
          <Txt variant="small" numberOfLines={1}>
            {altBilgi(k)}
          </Txt>
        </View>
      </Pressable>
      {k.me ? null : <TakipDugmesi kisi={k.id} takipte={k.i_follow} geriTakip={k.follows_me} onDegisti={onDegisti} />}
    </View>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 10 },
  kisi: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  btn: { height: 36, minWidth: 96, paddingHorizontal: 14, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  genis: { height: 48, borderRadius: 24, alignSelf: 'stretch' },
  btnOff: { backgroundColor: colors.terra, borderColor: colors.terra },
  btnOn: { backgroundColor: 'transparent', borderColor: colors.lineStrong },
}));
