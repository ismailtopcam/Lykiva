/**
 * Başka bir kişinin sayfası: bilgiler, takipçi / takip sayıları, Takip et ve görebildiğim aktiviteleri.
 */
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { kisiProfili, kisininAktiviteleri, type KisiAktivitesi, type KisiProfili } from '@/akis/akis';
import { RouteThumb } from '@/components/charts';
import { Header } from '@/components/Header';
import { TakipDugmesi } from '@/components/KisiSatiri';
import { Txt } from '@/components/Txt';
import { Avatar, Button, SectionHeader } from '@/components/ui';
import { basHarfler, grupRengi } from '@/grup/gruplar';
import { colors, fontFamily, space } from '@/theme';

export default function KisiScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [p, setP] = useState<KisiProfili | null | undefined>(undefined);
  const [aktiviteler, setAktiviteler] = useState<KisiAktivitesi[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    if (!id) return;
    try {
      setHata(null);
      const [pr, ak] = await Promise.all([kisiProfili(id), kisininAktiviteleri(id)]);
      setP(pr);
      setAktiviteler(ak);
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Yüklenemedi');
      setP((x) => x ?? null);
      setAktiviteler((x) => x ?? []);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  if (p === undefined) {
    return (
      <View style={styles.root}>
        <Header />
        <ActivityIndicator color={colors.terra} style={{ marginTop: space.xl }} />
      </View>
    );
  }
  if (!p) {
    return (
      <View style={styles.root}>
        <Header />
        <Txt variant="muted" style={{ textAlign: 'center', padding: space.xl }}>
          {hata ?? 'Kişi bulunamadı'}
        </Txt>
      </View>
    );
  }

  const takipListesi = (yon: 'takipci' | 'takip') => router.push({ pathname: '/kisi/[id]/takip', params: { id: p.id, yon } });
  const altBaslik = [`@${p.username}`, p.city].filter(Boolean).join(' · ');

  return (
    <View style={styles.root}>
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={styles.identity}>
          <Avatar initials={basHarfler(p.display_name)} tone={grupRengi(p.id)} size={76} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt variant="display" style={{ fontSize: 24 }} accessibilityRole="header" numberOfLines={2}>
              {p.display_name}
            </Txt>
            <Txt variant="muted" style={{ fontSize: 13 }}>
              {p.temporary ? 'Geçici hesap' : altBaslik}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
              <Sayi n={p.activity_count} etiket="aktivite" />
              <Sayi n={p.follower_count} etiket="takipçi" onPress={() => takipListesi('takipci')} />
              <Sayi n={p.following_count} etiket="takip" onPress={() => takipListesi('takip')} />
            </View>
          </View>
        </View>

        {p.bio ? <Txt style={{ paddingHorizontal: space.lg, marginBottom: space.md }}>{p.bio}</Txt> : null}

        <View style={{ paddingHorizontal: space.lg, marginBottom: space.lg }}>
          {p.me ? (
            <Button label="Profilim" variant="outline" onPress={() => router.navigate('/profil')} />
          ) : (
            <>
              <TakipDugmesi
                genis
                kisi={p.id}
                takipte={p.i_follow}
                geriTakip={p.follows_me}
                onDegisti={(t) => {
                  setP((x) => (x ? { ...x, i_follow: t, follower_count: x.follower_count + (t ? 1 : -1) } : x));
                  // Takipçilere açık aktiviteler görünür / gizlenir
                  void kisininAktiviteleri(p.id).then(setAktiviteler).catch(() => undefined);
                }}
              />
              {p.follows_me ? (
                <Txt variant="small" style={{ textAlign: 'center', marginTop: 6 }}>
                  Seni takip ediyor
                </Txt>
              ) : null}
            </>
          )}
        </View>

        <View style={{ paddingHorizontal: space.md }}>
          <View style={{ paddingHorizontal: space.xs }}>
            <SectionHeader title="Aktiviteler" />
          </View>
          {aktiviteler === null ? <ActivityIndicator color={colors.terra} style={{ marginVertical: space.lg }} /> : null}
          {aktiviteler && aktiviteler.length === 0 ? (
            <Txt variant="muted" style={{ textAlign: 'center', paddingVertical: space.lg, paddingHorizontal: space.lg }}>
              {p.me ? 'Henüz kaydın yok.' : p.i_follow ? 'Görebileceğin bir aktivite yok.' : 'Görebileceğin bir aktivite yok. Takip edersen takipçilere açık aktiviteleri de görürsün.'}
            </Txt>
          ) : null}
          <View style={{ gap: space.sm }}>
            {aktiviteler?.map((a) => (
              <Pressable key={a.id} accessibilityRole="link" onPress={() => router.push({ pathname: '/aktivite/[id]', params: { id: a.id } })} style={styles.row}>
                {a.route.length > 1 ? <RouteThumb route={a.route} /> : <View style={{ width: 64, height: 64 }} />}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
                    {a.title}
                  </Txt>
                  <Txt variant="small">{new Date(a.started_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</Txt>
                  <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 13, marginTop: 4 }}>{a.stats}</Txt>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Sayi({ n, etiket, onPress }: { n: number; etiket: string; onPress?: () => void }) {
  const icerik = (
    <Txt style={{ fontSize: 13 }}>
      <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 13 }}>{n}</Txt> <Txt style={{ color: colors.inkMuted, fontSize: 13 }}>{etiket}</Txt>
    </Txt>
  );
  if (!onPress) return icerik;
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`${n} ${etiket}`} onPress={onPress} hitSlop={10}>
      {icerik}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: space.lg, paddingBottom: 14 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
});
