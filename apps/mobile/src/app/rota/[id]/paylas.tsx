import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RouteThumb } from '@/components/charts';
import { Header } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { Avatar, Button, Card, Label, ListRow, ToggleRow } from '@/components/ui';
import { faralyaKabak, groups, people } from '@/data/ornek';
import { colors, fontFamily, space } from '@/theme';

export default function RotaPaylasScreen() {
  const insets = useSafeAreaInsets();
  const [sel, setSel] = useState<Record<string, boolean>>({ ornek: true, likya: true });
  const [persons, setPersons] = useState(['mert', 'zeynep']);
  const [edit, setEdit] = useState(false);
  const count = Object.values(sel).filter(Boolean).length + persons.length;

  return (
    <View style={styles.root}>
      <Header title="Rotayı paylaş" />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 4, paddingBottom: insets.bottom + 100 }}>
        <Card style={styles.route}>
          <RouteThumb route={faralyaKabak.route} size={56} />
          <View>
            <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }}>Faralya – Kabak – Alınca</Txt>
            <Txt variant="small">18,6 km · ↑ 540 m · Doğa yürüyüşü</Txt>
          </View>
        </Card>

        <Label>Gruplar ve topluluklar</Label>
        <Card style={{ marginBottom: 14 }}>
          {groups.map((g, i) => {
            const on = !!sel[g.id];
            return (
              <Pressable
                key={g.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => setSel({ ...sel, [g.id]: !on })}
                style={[styles.groupRow, i < groups.length - 1 && styles.sep]}>
                <Avatar initials={g.short} tone={g.tone} square />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14 }} numberOfLines={1}>
                    {g.name}
                  </Txt>
                  <Txt variant="small">{g.meta}</Txt>
                </View>
                <View style={[styles.box, on && styles.boxOn]}>{on ? <Txt style={{ color: '#FFF', fontFamily: fontFamily.bodyBold }}>✓</Txt> : null}</View>
              </Pressable>
            );
          })}
        </Card>

        <Label>Kişiler</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {persons.map((id) => {
            const p = people[id];
            return (
              <View key={id} style={styles.person}>
                <Avatar initials={p.initials} tone="sand" size={28} />
                <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.seaInk }}>{p.short}</Txt>
                <Pressable accessibilityRole="button" accessibilityLabel={`${p.short} kişisini kaldır`} onPress={() => setPersons(persons.filter((x) => x !== id))} style={styles.remove}>
                  <Icon name="close" size={14} color={colors.seaInk} strokeWidth={2.2} />
                </Pressable>
              </View>
            );
          })}
          <Pressable accessibilityRole="button" style={styles.addPerson}>
            <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 13 }}>+ Kişi ekle</Txt>
          </Pressable>
        </View>

        <View style={{ borderTopWidth: 1, borderTopColor: colors.lineStrong }}>
          <ToggleRow title="Düzenlemeye izin ver" subtitle="Paylaştıkların rotayı değiştirebilir" value={edit} onChange={setEdit} />
        </View>
        <ListRow icon="calendar" iconTone="terra" caption="Tarih belirle, katılımcı topla" title="Bu rotayla etkinlik oluştur" href="/etkinlik/olustur" />
      </ScrollView>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Button label={`${count} yere gönder`} icon="send" href="/grup/ornek/sohbet" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  route: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10, marginBottom: 14 },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, minHeight: 60 },
  sep: { borderBottomWidth: 1, borderBottomColor: '#ECE4D6' },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: '#9C9282', alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.sea, borderColor: colors.sea },
  person: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingLeft: 4, borderRadius: 18, backgroundColor: colors.seaSoft },
  remove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  addPerson: { height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#9C9282', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: 12, backgroundColor: colors.ground },
});
