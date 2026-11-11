import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RouteThumb } from '@/components/charts';
import { IconButton } from '@/components/IconButton';
import { Txt } from '@/components/Txt';
import { Avatar, Button, Card } from '@/components/ui';
import { aktivitelerim, haftaOzeti, profilim, type AktiviteSatiri, type Profilim } from '@/data/aktivite';
import { myActivities, people, weekKm } from '@/data/ornek';
import { rotalarim, type Rota } from '@/data/rota';
import { gruplarim, type GrupOzeti } from '@/grup/gruplar';
import { ACTIVITY_LABELS, DIFFICULTY_LABELS, formatKm, formatMeters, kmUnit, mUnit } from '@lykiva/shared';
import { baglantiPaylas, profilAdresi } from '@/lib/baglanti';
import { useHesap } from '@/lib/giris';
import { oturumuSagla, supabaseHazir } from '@/lib/supabase';
import { colors, fontFamily, space } from '@/theme';
import { $t } from '@/i18n';

const tabs = () => [$t('profil.aktiviteler'), $t('profil.rotalarim'), $t('profil.gruplar')];

export default function ProfilScreen() {
  const [tab, setTab] = useState(0);
  const [liste, setListe] = useState<AktiviteSatiri[] | null>(null);
  const [profil, setProfil] = useState<Profilim | null>(null);
  const [rotalar, setRotalar] = useState<Rota[] | null>(null);
  const [gruplar, setGruplar] = useState<GrupOzeti[] | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const hesap = useHesap();

  // Sekmeye her dönüşte yenile (yeni kayıt, gönderilen kuyruk)
  useFocusEffect(
    useCallback(() => {
      let acik = true;
      (async () => {
        const uid = supabaseHazir ? await oturumuSagla().catch(() => null) : null;
        const [l, pr, ro, gr] = await Promise.all([
          aktivitelerim(uid).catch(() => []),
          uid ? profilim(uid).catch(() => null) : null,
          rotalarim().catch(() => []),
          uid ? gruplarim().catch(() => []) : Promise.resolve([]),
        ]);
        if (acik) {
          setUid(uid);
          setListe(l);
          setProfil(pr);
          setRotalar(ro);
          setGruplar(gr);
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
  const ad = gercek ? (profil?.displayName ?? $t('ortak.sen')) : people.me.name;
  const bas = ad
    .split(' ')
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 2)
    .toLocaleUpperCase('tr-TR');
  const altBaslik = gercek ? (profil ? `@${profil.username}${profil.city ? ' · ' + profil.city : ''}` : $t('profil.gecici_hesap')) : 'Antalya · Bisiklet, doğa yürüyüşü';
  // Takipçi / takip sayısına dokununca liste açılır (gerçek hesapta)
  const takipListesi = (yon: 'takipci' | 'takip') => (uid ? () => router.push({ pathname: '/kisi/[id]/takip', params: { id: uid, yon } }) : undefined);
  const sayilar: [string, string, (() => void)?][] = gercek
    ? [
        [String(satirlar.length), 'aktivite'],
        [String(profil?.takipci ?? 0), $t('profil.takipci'), takipListesi('takipci')],
        [String(profil?.takip ?? 0), 'takip', takipListesi('takip')],
      ]
    : [
        ['128', 'aktivite'],
        ['342', $t('profil.takipci')],
        ['210', 'takip'],
      ];
  const gunler = gercek ? hafta.gunler : weekKm;
  const maxKm = Math.max(0.001, ...gunler.map((d) => d.km));
  const haftaToplam: [string, string][] = gercek
    ? [
        [formatKm(hafta.km * 1000), kmUnit()],
        [`${Math.floor(hafta.sn / 3600)}:${String(Math.floor((hafta.sn % 3600) / 60)).padStart(2, '0')}`, $t('ortak.birim_sa')],
        [formatMeters(hafta.m), mUnit()],
      ]
    : [
        ['64,2', kmUnit()],
        ['5:12', $t('ortak.birim_sa')],
        ['1.240', mUnit()],
      ];

  // Web profili yalnızca kalıcı hesaplarda var (geçici hesabın adresi açılmaz)
  function profiliPaylas() {
    if (!profil) return;
    if (hesap?.gecici) {
      Alert.alert($t('profil.once_giris_yap'), $t('profil.gecici_hesabin_web_profili'));
      return;
    }
    void baglantiPaylas($t('profil.lykiva_da', { displayName: profil.displayName }), profilAdresi(profil.username));
  }

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.top}>
        {supabaseHazir ? <IconButton icon="search" label={$t('ortak.kisi_ara')} onPress={() => router.push('/kisiler')} /> : null}
        {gercek && profil ? <IconButton icon="share" label={$t('profil.profili_paylas')} onPress={profiliPaylas} /> : null}
        <IconButton icon="more" label={$t('profil.ayarlar')} onPress={() => router.push('/ayarlar')} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.identity}>
          <Avatar initials={bas} tone="ink" size={76} uri={gercek ? profil?.avatarUrl : null} />
          <View style={{ flex: 1 }}>
            <Txt variant="display" style={{ fontSize: 24 }}>
              {ad}
            </Txt>
            <Txt variant="muted" style={{ fontSize: 13 }}>
              {altBaslik}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
              {sayilar.map(([n, l, onPress]) => (
                <Pressable key={l} accessibilityRole={onPress ? 'link' : undefined} disabled={!onPress} onPress={onPress} hitSlop={10}>
                  <Txt style={{ fontSize: 13 }}>
                    <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 13 }}>{n}</Txt> <Txt style={{ color: colors.inkMuted, fontSize: 13 }}>{l}</Txt>
                  </Txt>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
        {gercek && profil?.bio ? (
          <Txt style={{ paddingHorizontal: space.lg, marginTop: -4, marginBottom: 12, fontSize: 14 }}>{profil.bio}</Txt>
        ) : null}
        {gercek && profil ? (
          <View style={{ paddingHorizontal: space.lg, marginBottom: 14 }}>
            <Button label={$t('profil.profili_duzenle')} icon="user" variant="outline" href="/profil-duzenle" />
          </View>
        ) : null}

        {supabaseHazir && hesap?.gecici ? (
          <Card style={styles.gecici}>
            <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }}>{$t('profil.gecici_hesaptasin')}</Txt>
            <Txt variant="small" style={{ marginTop: 2, marginBottom: space.md }}>
              {$t('profil.kayitlarin_simdilik_yalnizca_bu')}</Txt>
            <Button label={$t('profil.giris_yap_ya_da')} href="/giris" />
          </Card>
        ) : null}

        <Card dark style={styles.week}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Txt variant="label" color="#B9C2BA">
              {$t('profil.bu_hafta')}</Txt>
            <Txt variant="small" color="#B9C2BA">
              {gercek ? hafta.aralik : $t('profil.m_3_9_kasim')}
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
          <View style={styles.bars} accessible accessibilityLabel={$t('profil.bu_haftanin_gunluk_mesafe')}>
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
          {tabs().map((t, i) => (
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

        {tab === 1 ? (
          <View style={{ padding: space.md, gap: space.sm }}>
            <Button label={$t('profil.yeni_rota_ciz')} icon="route" variant="outline" href="/rota/olustur" />
            {rotalar && rotalar.length === 0 ? (
              <Txt variant="muted" style={{ textAlign: 'center', paddingVertical: space.lg }}>
                {$t('profil.henuz_rotan_yok_yeni')}</Txt>
            ) : null}
            {(rotalar ?? []).map((r) => (
              <Pressable key={r.id} accessibilityRole="link" onPress={() => router.push({ pathname: '/rota/[id]', params: { id: r.id } })} style={styles.row}>
                {r.points.length > 1 ? <RouteThumb route={r.points.map((p) => [p.lng, p.lat] as [number, number])} /> : <View style={{ width: 64, height: 64 }} />}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
                    {r.name}
                  </Txt>
                  <Txt variant="small">
                    {ACTIVITY_LABELS[r.activity]}
                    {r.difficulty ? ` · ${DIFFICULTY_LABELS[r.difficulty]}` : ''}
                    {r.isLoop ? $t('profil.dongu') : ''}
                  </Txt>
                  <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 13, marginTop: 4 }}>
                    {$t('profil.km_m', { km: formatKm(r.distanceM), meters: formatMeters(r.gainM) })}</Txt>
                </View>
              </Pressable>
            ))}
          </View>
        ) : tab === 2 ? (
          <View style={{ padding: space.md, gap: space.sm }}>
            {gruplar && gruplar.length === 0 ? (
              <Txt variant="muted" style={{ textAlign: 'center', paddingVertical: space.lg }}>
                {$t('profil.henuz_bir_gruba_katilmadin')}</Txt>
            ) : null}
            {!gercek ? (
              <Txt variant="muted" style={{ textAlign: 'center', paddingVertical: space.lg }}>
                {$t('profil.sunucu_anahtari_girilince_gruplarin')}</Txt>
            ) : null}
            {(gruplar ?? []).map((g) => (
              <Pressable key={g.id} accessibilityRole="link" onPress={() => router.push({ pathname: '/grup/[id]', params: { id: g.id } })} style={styles.row}>
                <Avatar initials={g.name.slice(0, 2).toLocaleUpperCase('tr-TR')} tone={g.is_community ? 'sea' : 'terra'} size={48} square />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
                    {g.name}
                  </Txt>
                  <Txt variant="small">
                    {$t('profil.uye', { a: g.is_community ? $t('profil.topluluk') : $t('ortak.grup'), member_count: g.member_count, a2: g.my_role === 'owner' ? $t('profil.kurucu') : g.my_role === 'admin' ? $t('profil.yonetici') : '' })}</Txt>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
        <View style={{ padding: space.md, gap: space.sm }}>
          {liste && satirlar.length === 0 ? (
            <Txt variant="muted" style={{ textAlign: 'center', paddingVertical: space.lg }}>
              {$t('profil.henuz_kaydin_yok_ortadaki')}</Txt>
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
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: space.sm },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: space.lg, paddingBottom: 14 },
  gecici: { marginHorizontal: space.md, padding: space.lg, marginBottom: 14 },
  week: { marginHorizontal: space.md, padding: space.lg, marginBottom: 14 },
  bars: { flexDirection: 'row', gap: 8, height: 76, alignItems: 'flex-end' },
  tabs: { flexDirection: 'row', marginHorizontal: space.lg, borderBottomWidth: 1, borderBottomColor: colors.lineStrong },
  tab: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: colors.ink },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
});
