import { ACTIVITY_LABELS } from '@lykiva/shared';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { IlerlemeCubugu } from '@/components/IlerlemeCubugu';
import { Txt } from '@/components/Txt';
import { olcuMetni, olcuYazi } from '@/data/hedef';
import { durumu, tamamlandiMi, type MeydanOkuma } from '@/data/meydanOkuma';
import { colors, fontFamily } from '@/theme';
import { $t, yerel } from '@/i18n';

/** "9 Kas – 15 Kas" (bitiş dahil değil: bir önceki gün yazılır) */
export function aralikMetni(bas: string, bitis: string): string {
  const b = new Date(bas);
  const s = new Date(Date.parse(bitis) - 1);
  const bicim: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (b.getFullYear() !== s.getFullYear()) Object.assign(bicim, { year: 'numeric' });
  const bm = b.toLocaleDateString(yerel(), bicim);
  const sm = s.toLocaleDateString(yerel(), bicim);
  return bm === sm ? bm : `${bm} – ${sm}`;
}

/** "3 gün kaldı", "2 gün sonra başlıyor", "Bitti" */
export function zamanMetni(m: Pick<MeydanOkuma, 'baslangic' | 'bitis'>, simdi: number): string {
  const d = durumu(m, simdi);
  if (d === 'bitti') return $t('meydan.bitti');
  if (d === 'yaklasan') {
    const n = Math.max(1, Math.ceil((Date.parse(m.baslangic) - simdi) / 86_400_000));
    return $t('meydan.basliyor', { n });
  }
  const kalan = Date.parse(m.bitis) - simdi;
  if (kalan < 86_400_000) return $t('meydan.son_gun');
  return $t('meydan.kaldi', { n: Math.ceil(kalan / 86_400_000) });
}

/** "100 km · Bisiklet, Dağ bisikleti" */
export function hedefMetni(m: Pick<MeydanOkuma, 'olcu' | 'hedef' | 'turler'>): string {
  const h = olcuYazi(m.olcu, m.hedef);
  return m.turler.length ? `${h} · ${m.turler.map((t) => ACTIVITY_LABELS[t]).join(', ')}` : h;
}

export function MeydanOkumaKarti({ m, simdi, grupGoster = true }: { m: MeydanOkuma; simdi: number; grupGoster?: boolean }) {
  const d = durumu(m, simdi);
  const tamam = tamamlandiMi(m);
  const deger = m.degerim ?? 0;
  const dm = olcuMetni(m.olcu, deger);
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push({ pathname: '/meydan-okuma/[id]', params: { id: m.id } })}
      style={({ pressed }) => [styles.kart, d === 'bitti' && !tamam && { opacity: 0.75 }, pressed && { opacity: 0.8 }]}>
      <View style={styles.ust}>
        <View style={[styles.ikon, { backgroundColor: tamam ? colors.seaSoft : m.group_id ? colors.sand : colors.terraSoft }]}>
          <Icon name={tamam ? 'medal' : 'flag'} color={tamam ? colors.seaInk : m.group_id ? colors.sandInk : colors.terraInk} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 15 }} numberOfLines={2}>
            {m.baslik}
          </Txt>
          <Txt variant="small" numberOfLines={1}>
            {hedefMetni(m)}
          </Txt>
          <Txt variant="small" numberOfLines={1}>
            {aralikMetni(m.baslangic, m.bitis)} · {zamanMetni(m, simdi)}
            {grupGoster && m.grup_adi ? ` · ${m.grup_adi}` : ''}
          </Txt>
        </View>
        <Icon name="chevron" size={18} color={colors.inkMuted} strokeWidth={2} />
      </View>
      {m.katildim ? (
        <View style={{ marginTop: 10, gap: 6 }}>
          <IlerlemeCubugu oran={m.hedef > 0 ? deger / m.hedef : 0} renk={tamam ? colors.sea : colors.terra} yukseklik={8} />
          <Txt variant="small">
            {tamam
              ? $t('meydan.tamamladin')
              : $t('meydan.ilerlemen', { deger: `${dm.value} ${dm.unit}`, hedef: olcuYazi(m.olcu, m.hedef) })}
            {' · '}
            {$t('meydan.katilimci', { n: m.katilimci_sayisi })}
          </Txt>
        </View>
      ) : (
        <Txt variant="small" style={{ marginTop: 8 }}>
          {$t('meydan.katilimci', { n: m.katilimci_sayisi })}
        </Txt>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kart: { padding: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  ust: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ikon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
