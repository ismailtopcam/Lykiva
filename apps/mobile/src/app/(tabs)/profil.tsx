import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RouteThumb } from '@/components/charts';
import { IconButton } from '@/components/IconButton';
import { Txt } from '@/components/Txt';
import { Avatar, Card } from '@/components/ui';
import { aktivitelerim, haftaOzeti, profilim, type AktiviteSatiri, type Profilim } from '@/data/aktivite';
import { myActivities, people, weekKm } from '@/data/ornek';
import { formatKm, formatMeters } from '@lykiva/shared';
import { oturumuSagla, supabaseHazir } from '@/lib/supabase';
import { colors, fontFamily, space } from '@/theme';

const tabs = ['Aktiviteler', 'Rotalarım', 'Gruplar'];

export default function ProfilScreen() {
  const [tab, setTab] = useState(0);
  const [liste, setListe] = useState<AktiviteSatiri[] | null>(null);
  const [profil, setProfil] = useState<Profilim | null>(null);

  // Sekmeye her dönüşte yenile (yeni kayıt, gönderilen kuyruk)
  useFocusEffect(
    useCallback(() => {
      let acik = true;
      (async () => {
        const uid = supabaseHazir ? await oturumuSagla().catch(() => null) : null;
        const [l, pr] = await Promise.all([aktivitelerim(uid).catch(() => []), uid ? profilim(uid).catch(() => null) : null]);
        if (acik) {
          setListe(l);
          setProfil(pr);
        }
      })();
      return () => {
        acik = false;
      };
    }, []),
  );

  // Sunucu anahtarı yoksa tasarım örneği gösterilir; varsa gerçek kayıtlar (+ telefonda bekleyenler)
  const gercek = supabaseHazir || (liste?.length ?? 0) > 0;
  const satirlar: AktiviteSatiri[] = gercek ? (liste ?? []) : myActivities;
  const hafta = haftaOzeti(satirlar);
  const ad = gercek ? (profil?.displayName ?? 'Sen') : people.me.name;
  const bas = ad
    .split(' ')
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 2)
    .toLocaleUpperCase('tr-TR');
  const altBaslik = gercek ? (profil ? `@${profil.username}${profil.city ? ' · ' + profil.city : ''}` : 'Geçici hesap') : 'Antalya · Bisiklet, doğa yürüyüşü';
  const sayilar: [string, string][] = gercek
    ? [
        [String(satirlar.length), 'aktivite'],
        [String(profil?.takipci ?? 0), 'takipçi'],
        [String(profil?.takip ?? 0), 'takip'],
      ]
    : [
        ['128', 'aktivite'],
        ['342', 'takipçi'],
        ['210', 'takip'],
      ];
  const gunler = gercek ? hafta.gunler : weekKm;
  const maxKm = Math.max(0.001, ...gunler.map((d) => d.km));
  const haftaToplam: [string, string][] = gercek
    ? [
        [formatKm(hafta.km * 1000), 'km'],
        [`${Math.floor(hafta.sn / 3600)}:${String(Math.floor((hafta.sn % 3600) / 60)).padStart(2, '0')}`, 'sa'],
        [formatMeters(hafta.m), 'm'],
      ]
    : [
        ['64,2', 'km'],
        ['5:12', 'sa'],
        ['1.240', 'm'],
      ];

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.top}>
        <IconButton icon="share" label="Profili paylaş" />
        <IconButton icon="layers" label="Ayarlar" />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.identity}>
          <Avatar initials={bas} tone="ink" size={76} />
          <View style={{ flex: 1 }}>
            <Txt variant="display" style={{ fontSize: 24 }}>
              {ad}
            </Txt>
            <Txt variant="muted" style={{ fontSize: 13 }}>
              {altBaslik}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
              {sayilar.map(([n, l]) => (
                <Txt key={l} style={{ fontSize: 13 }}>
                  <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 13 }}>{n}</Txt> <Txt style={{ color: colors.inkMuted, fontSize: 13 }}>{l}</Txt>
                </Txt>
              ))}
            </View>
          </View>
        </View>

        <Card dark style={styles.week}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Txt variant="label" color="#B9C2BA">
              Bu hafta
            </Txt>
            <Txt variant="small" color="#B9C2BA">
              {gercek ? hafta.aralik : '3 – 9 Kasım'}
            </Txt>
          </View>
          <View style={{ flexDirection: 'row', gap: 20, marginVertical: 10 }}>
            {haftaToplam.map(([v, u]) => (
              <Txt key={u} style={{ fontFamily: fontFamily.displayHeavy, fontSize: 30, color: colors.night.text, letterSpacing: -0.6 }}>
                {v}
                <Txt style={{ fontFamily: fontFamily.bodyMedium, fontSize: 14, color: colors.night.text }}> {u}</Txt>
              </Txt>
            ))}
          </View>
          <View style={styles.bars} accessible accessibilityLabel="Bu haftanın günlük mesafe grafiği">
            {gunler.map((d) => (
              <View key={d.day} style={{ flex: 1, alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                <View
                  style={{
                    width: '100%',
                    height: d.km ? Math.max(8, (d.km / maxKm) * 56) : 4,
                    borderRadius: d.km ? 6 : 2,
                    backgroundColor: d.km === maxKm ? colors.night.accent : d.km ? '#0F8A86' : '#33413A',
                  }}
                />
                <Txt style={{ fontSize: 11, color: d.km === maxKm ? colors.night.text : '#B9C2BA', fontFamily: d.km === maxKm ? fontFamily.bodyBold : fontFamily.body }}>
                  {d.day}
                </Txt>
              </View>
            ))}
          </View>
        </Card>

        <View accessibilityRole="tablist" style={styles.tabs}>
          {tabs.map((t, i) => (
            <Pressable
              key={t}
              accessibilityRole="tab"
              accessibilityState={{ selected: i === tab }}
              onPress={() => setTab(i)}
              style={[styles.tab, i === tab && styles.tabOn]}>
              <Txt style={{ fontFamily: i === tab ? fontFamily.bodyBold : fontFamily.bodySemiBold, fontSize: 14, color: i === tab ? colors.ink : colors.inkMuted }}>{t}</Txt>
            </Pressable>
          ))}
        </View>

        <View style={{ padding: space.md, gap: space.sm }}>
          {liste && satirlar.length === 0 ? (
            <Txt variant="muted" style={{ textAlign: 'center', paddingVertical: space.lg }}>
              Henüz kaydın yok. Ortadaki düğmeyle ilk kaydını başlat.
            </Txt>
          ) : null}
          {satirlar.map((a) => (
            <Pressable key={a.id} accessibilityRole="link" onPress={() => router.push({ pathname: '/aktivite/[id]', params: { id: a.id } })} style={styles.row}>
              {a.route.length > 1 ? <RouteThumb route={a.route} /> : <View style={{ width: 64, height: 64 }} />}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
                  {a.title}
                </Txt>
                <Txt variant="small">{a.meta}</Txt>
                <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 13, marginTop: 4 }}>{a.stats}</Txt>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: space.sm },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: space.lg, paddingBottom: 14 },
  week: { marginHorizontal: space.md, padding: space.lg, marginBottom: 14 },
  bars: { flexDirection: 'row', gap: 8, height: 76, alignItems: 'flex-end' },
  tabs: { flexDirection: 'row', marginHorizontal: space.lg, borderBottomWidth: 1, borderBottomColor: colors.lineStrong },
  tab: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: colors.ink },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
});
