import { formatKm } from '@lykiva/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RouteThumb } from '@/components/charts';
import { FloatingHeader } from '@/components/Header';
import { Icon, type IconName } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { OrnekGrup } from '@/components/OrnekGrup';
import { MeydanOkumaKarti } from '@/components/MeydanOkumaKarti';
import { useSikayet } from '@/components/SikayetPenceresi';
import { Txt } from '@/components/Txt';
import { Avatar, Button, DateBadge } from '@/components/ui';
import { meydanOkumalar, type MeydanOkuma } from '@/data/meydanOkuma';
import { grupEtkinlikleri, kisaTarih, tarihRozeti, type EtkinlikOzeti } from '@/etkinlik/etkinlikler';
import {
  basHarfler,
  bekleyenIstekler,
  davetKoduYenile,
  davetMetni,
  grubaKatil,
  grupCanliSayisi,
  grupDetayi,
  grupEtiketi,
  grupRengi,
  grupRotalari,
  grupUyeleri,
  gruptanAyril,
  istegiGeriAl,
  istegiYanitla,
  kisaZaman,
  onizleme,
  ROL_ADI,
  uyeCikar,
  uyeRoluDegistir,
  uyeSayisi,
  type GrupDetayi,
  type GrupRotasi,
  type Istek,
  type Uye,
} from '@/grup/gruplar';
import { useHesap } from '@/lib/giris';
import { colors, fontFamily, space } from '@/theme';
import { $t } from '@/i18n';

const uuidMi = (id: string | undefined) => !!id && /^[0-9a-f-]{36}$/i.test(id);

export default function GrupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return uuidMi(id) ? <GercekGrup id={id} /> : <OrnekGrup />;
}

type Sekme = 'etkinlikler' | 'rotalar' | 'meydan' | 'uyeler' | 'istekler';

function GercekGrup({ id }: { id: string }) {
  const insets = useSafeAreaInsets();
  const hesap = useHesap();
  const sikayet = useSikayet();
  const [g, setG] = useState<GrupDetayi | null | undefined>(undefined);
  const [uyeler, setUyeler] = useState<Uye[]>([]);
  const [rotalar, setRotalar] = useState<GrupRotasi[]>([]);
  const [istekler, setIstekler] = useState<Istek[]>([]);
  const [etkinlikler, setEtkinlikler] = useState<EtkinlikOzeti[]>([]);
  const [meydanlar, setMeydanlar] = useState<MeydanOkuma[]>([]);
  // Geçmiş etkinlikleri soluk göstermek için yükleme anı (render sırasında saat okunmaz)
  const [yuklenme, setYuklenme] = useState(0);
  const [canliSayisi, setCanliSayisi] = useState(0);
  const [sekme, setSekme] = useState<Sekme>('etkinlikler');
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);

  const yukle = useCallback(async () => {
    try {
      setHata(null);
      const d = await grupDetayi(id);
      setG(d);
      if (!d) return;
      const uye = !!d.my_role;
      const yonetici = d.my_role === 'owner' || d.my_role === 'admin';
      const [u, r, i, e, mo] = await Promise.all([
        grupUyeleri(id),
        uye ? grupRotalari(id) : Promise.resolve([]),
        yonetici ? bekleyenIstekler(id) : Promise.resolve([]),
        uye ? grupEtkinlikleri(id).catch(() => []) : Promise.resolve([]),
        // Sunucuda migration yoksa sekme boş kalır
        uye ? meydanOkumalar(id).catch(() => []) : Promise.resolve([]),
      ]);
      if (uye) void grupCanliSayisi(id).then(setCanliSayisi).catch(() => undefined);
      setUyeler(u);
      setRotalar(r);
      setIstekler(i);
      setEtkinlikler(e);
      setMeydanlar(mo);
      setYuklenme(Date.now());
    } catch (e) {
      setHata(e instanceof Error ? e.message : $t('grup.grup_yuklenemedi'));
      setG((x) => (x === undefined ? null : x));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  if (!g) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', padding: space.lg }]}>
        <FloatingHeader />
        {g === undefined ? <ActivityIndicator color={colors.terra} /> : <Txt variant="muted">{hata ?? $t('grup.grup_bulunamadi_ya_da')}</Txt>}
      </View>
    );
  }

  const grup = g;
  const uye = !!grup.my_role;
  const yonetici = grup.my_role === 'owner' || grup.my_role === 'admin';
  const sahip = grup.my_role === 'owner';

  async function islem(f: () => Promise<unknown>) {
    setMesgul(true);
    try {
      await f();
      await yukle();
    } catch (e) {
      Alert.alert($t('grup.yapilamadi'), e instanceof Error ? e.message : String(e));
    } finally {
      setMesgul(false);
    }
  }

  async function davetEt() {
    if (!grup.invite_code) return;
    await Share.share({ message: davetMetni(grup.name, grup.invite_code) }).catch(() => undefined);
  }

  function ayarlar() {
    const secenekler: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] = [];
    if (yonetici)
      secenekler.push({
        text: $t('grup.davet_kodunu_yenile'),
        onPress: () =>
          void islem(async () => {
            const k = await davetKoduYenile(grup.id);
            Alert.alert($t('grup.yeni_davet_kodu'), $t('grup.eski_kod_artik_calismaz', { k }));
          }),
      });
    if (!sahip) secenekler.push({ text: $t('ortak.sikayet_et'), onPress: () => sikayet.ac('group', grup.id, grup.name) });
    if (uye) secenekler.push({
      text: $t('grup.gruptan_ayril'),
      style: 'destructive',
      onPress: () =>
        Alert.alert(
          $t('grup.gruptan_ayrilinsin_mi'),
          sahip
            ? grup.member_count > 1
              ? $t('grup.grup_sahibisin_sahiplik_bir')
              : $t('grup.gruptaki_son_kisisin_ayrilirsan')
            : $t('grup.tekrar_katilmak_icin_davet'),
          [
            { text: $t('ortak.vazgec'), style: 'cancel' },
            {
              text: $t('grup.ayril'),
              style: 'destructive',
              onPress: () =>
                void islem(async () => {
                  await gruptanAyril(grup.id);
                  router.back();
                }),
            },
          ],
        ),
    });
    secenekler.push({ text: $t('ortak.vazgec'), style: 'cancel' });
    Alert.alert(grup.name, undefined, secenekler);
  }

  function uyeSecenekleri(u: Uye) {
    if (!yonetici || u.user_id === hesap?.id || u.role === 'owner') return;
    const secenekler: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] = [];
    if (sahip) {
      secenekler.push(
        u.role === 'admin'
          ? { text: $t('grup.yoneticilikten_al'), onPress: () => void islem(() => uyeRoluDegistir(grup.id, u.user_id, false)) }
          : { text: $t('grup.yonetici_yap'), onPress: () => void islem(() => uyeRoluDegistir(grup.id, u.user_id, true)) },
      );
    }
    if (sahip || u.role === 'member') {
      secenekler.push({ text: $t('grup.gruptan_cikar'), style: 'destructive', onPress: () => void islem(() => uyeCikar(grup.id, u.user_id)) });
    }
    secenekler.push({ text: $t('ortak.vazgec'), style: 'cancel' });
    Alert.alert(u.display_name, ROL_ADI()[u.role], secenekler);
  }

  const kisayollar: { label: string; icon: IconName; onPress: () => void; dark?: boolean }[] = uye
    ? [
        { label: $t('grup.sohbet'), icon: 'chat', dark: true, onPress: () => router.push({ pathname: '/grup/[id]/sohbet', params: { id: grup.id } }) },
        { label: canliSayisi ? $t('grup.canli', { canliSayisi }) : $t('grup.canli_harita'), icon: 'pin', onPress: () => router.push({ pathname: '/canli-harita', params: { grup: grup.id } }) },
        { label: $t('grup.etkinlik'), icon: 'calendar', onPress: () => router.push({ pathname: '/etkinlik/olustur', params: { grup: grup.id } }) },
        { label: $t('grup.rota_paylas'), icon: 'route', onPress: () => router.push({ pathname: '/grup/[id]/rota-paylas', params: { id: grup.id } }) },
        ...(yonetici ? [{ label: $t('grup.davet_et'), icon: 'share' as IconName, onPress: () => void davetEt() }] : []),
      ]
    : [];

  const sekmeler: { id: Sekme; ad: string }[] = [
    ...(uye ? [{ id: 'etkinlikler' as Sekme, ad: $t('grup.etkinlikler') }, { id: 'rotalar' as Sekme, ad: $t('grup.rotalar') }, { id: 'meydan' as Sekme, ad: $t('meydan.grup_sekmesi') }] : []),
    { id: 'uyeler', ad: $t('grup.uyeler', { member_count: grup.member_count }) },
    ...(yonetici && grup.pending_count > 0 ? [{ id: 'istekler' as Sekme, ad: $t('grup.istekler', { pending_count: grup.pending_count }) }] : []),
  ];
  const aktifSekme = sekmeler.some((s) => s.id === sekme) ? sekme : sekmeler[0].id;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
      <View style={[styles.hero, { paddingTop: insets.top + 6 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: -8 }}>
          <IconButton icon="back" label={$t('ortak.geri')} color="#FFFFFF" onPress={() => router.back()} />
          <IconButton icon="more" label={$t('grup.grup_secenekleri')} color="#FFFFFF" onPress={ayarlar} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
          <Avatar initials={basHarfler(grup.name)} tone={grupRengi(grup.id)} size={52} square />
          <View style={{ flex: 1 }}>
            <Txt variant="label" color="#CFE8E5">
              {grupEtiketi(grup)}
            </Txt>
            <Txt style={styles.title} accessibilityRole="header">
              {grup.name}
            </Txt>
          </View>
        </View>
        <Txt style={{ fontSize: 13, color: '#E2F0EE', marginTop: 4 }}>
          {uyeSayisi(grup.member_count)} · {grup.is_private ? $t('grup.ozel_grup') : grup.requires_approval ? $t('grup.acik_onayli_katilim') : $t('grup.acik_topluluk')}
          {grup.my_role ? ` · ${ROL_ADI()[grup.my_role]}` : ''}
        </Txt>
        {grup.description ? <Txt style={{ fontSize: 14, lineHeight: 20, color: '#FFFFFF', marginTop: 10 }}>{grup.description}</Txt> : null}
      </View>

      {!uye ? (
        <View style={{ padding: space.lg, gap: space.sm }}>
          <Button
            label={mesgul ? '…' : grup.requested ? $t('grup.istegi_geri_al') : grup.requires_approval ? $t('grup.katilma_istegi_gonder') : $t('grup.topluluga_katil')}
            icon={grup.requested ? 'close' : 'users'}
            variant={grup.requested ? 'outline' : 'primary'}
            disabled={mesgul}
            onPress={() => void islem(() => (grup.requested ? istegiGeriAl(grup.id) : grubaKatil(grup.id)))}
          />
          {grup.requested ? <Txt variant="small">{$t('grup.istegin_yoneticilere_iletildi_onaylaninc')}</Txt> : null}
        </View>
      ) : (
        <View style={styles.shortcuts}>
          {kisayollar.map((s) => (
            <Pressable key={s.label} accessibilityRole="button" onPress={s.onPress} style={[styles.shortcut, s.dark && { backgroundColor: colors.ink, borderColor: colors.ink }]}>
              <Icon name={s.icon} color={s.dark ? colors.ground : colors.ink} />
              <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 12, color: s.dark ? colors.ground : colors.ink }}>{s.label}</Txt>
            </Pressable>
          ))}
        </View>
      )}

      {yonetici && grup.invite_code ? (
        <Pressable accessibilityRole="button" accessibilityLabel={$t('grup.davet_kodu_paylas', { split: grup.invite_code.split('').join(' ') })} onPress={() => void davetEt()} style={styles.kod}>
          <Txt variant="small">{$t('grup.davet_kodu')}</Txt>
          <Txt style={{ fontFamily: fontFamily.displayHeavy, fontSize: 20, letterSpacing: 3 }}>{grup.invite_code}</Txt>
        </Pressable>
      ) : null}

      <View accessibilityRole="tablist" style={styles.tabs}>
        {sekmeler.map((s) => (
          <Pressable key={s.id} accessibilityRole="tab" accessibilityState={{ selected: s.id === aktifSekme }} onPress={() => setSekme(s.id)} style={[styles.tab, s.id === aktifSekme && styles.tabOn]}>
            <Txt style={{ fontFamily: s.id === aktifSekme ? fontFamily.bodyBold : fontFamily.bodySemiBold, fontSize: 14, color: s.id === aktifSekme ? colors.ink : colors.inkMuted }}>{s.ad}</Txt>
          </Pressable>
        ))}
      </View>

      <View style={{ padding: space.lg, gap: 10 }}>
        {aktifSekme === 'etkinlikler' ? (
          etkinlikler.length === 0 ? (
            <Txt variant="muted">{$t('grup.planlanmis_etkinlik_yok_etkinlik')}</Txt>
          ) : (
            etkinlikler.map((e) => {
              const r = tarihRozeti(e.starts_at);
              const gecmis = yuklenme > 0 && Date.parse(e.starts_at) < yuklenme - 3 * 3600_000;
              return (
                <Pressable key={e.id} accessibilityRole="link" onPress={() => router.push({ pathname: '/etkinlik/[id]', params: { id: e.id } })} style={[styles.card, gecmis && { opacity: 0.6 }]}>
                  <DateBadge month={r.ay} day={r.gun} tone={gecmis ? 'sea' : 'terra'} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 15 }} numberOfLines={1}>
                      {e.title}
                    </Txt>
                    <Txt variant="small">
                      {$t('grup.kisi', { kisaTarih: kisaTarih(e.starts_at), going_count: e.going_count, a: e.capacity ? `/${e.capacity}` : '' })}</Txt>
                  </View>
                  {e.my_status === 'going' ? (
                    <View style={[styles.rol, { backgroundColor: colors.terraSoft }]}>
                      <Txt style={{ fontSize: 11, fontFamily: fontFamily.bodyBold, color: colors.terraInk }}>{$t('grup.gidiyorsun')}</Txt>
                    </View>
                  ) : null}
                </Pressable>
              );
            })
          )
        ) : aktifSekme === 'rotalar' ? (
          rotalar.length === 0 ? (
            <Txt variant="muted">{$t('grup.gruba_henuz_rota_paylasilmadi')}</Txt>
          ) : (
            rotalar.map((r) => (
              <Pressable key={r.id} accessibilityRole="link" onPress={() => router.push({ pathname: '/rota/[id]', params: { id: r.id } })} style={styles.card}>
                {r.preview && r.preview.length > 1 ? <RouteThumb route={onizleme(r.preview)} size={56} color={colors.sea} /> : <View style={{ width: 56, height: 56 }} />}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
                    {r.name}
                  </Txt>
                  <Txt variant="small">
                    {$t('grup.km', { km: formatKm(r.distance_m), a: r.elevation_gain_m != null ? $t('grup.m', { round: Math.round(r.elevation_gain_m) }) : '' })}</Txt>
                  <Txt variant="small">
                    {r.owner_name} · {kisaZaman(r.shared_at)}
                  </Txt>
                </View>
              </Pressable>
            ))
          )
        ) : aktifSekme === 'meydan' ? (
          <>
            <Button label={$t('meydan.baslat_grupta')} icon="flag" variant="outline" onPress={() => router.push({ pathname: '/meydan-okuma/olustur', params: { grup: grup.id } })} />
            {meydanlar.length === 0 ? (
              <Txt variant="muted">{$t('meydan.grupta_yok')}</Txt>
            ) : (
              meydanlar
                .slice()
                .sort((x, y) => Date.parse(y.bitis) - Date.parse(x.bitis))
                .map((m) => <MeydanOkumaKarti key={m.id} m={m} simdi={yuklenme} grupGoster={false} />)
            )}
          </>
        ) : aktifSekme === 'uyeler' ? (
          uyeler.map((u) => (
            <Pressable
              key={u.user_id}
              accessibilityRole={yonetici && u.role !== 'owner' && u.user_id !== hesap?.id ? 'button' : 'text'}
              onPress={() => uyeSecenekleri(u)}
              disabled={mesgul}
              style={styles.uye}>
              <Avatar initials={basHarfler(u.display_name)} tone={grupRengi(u.user_id)} size={40} uri={u.avatar_url} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
                  {u.display_name}
                  {u.user_id === hesap?.id ? $t('grup.sen') : ''}
                </Txt>
                <Txt variant="small">@{u.username}</Txt>
              </View>
              {u.role !== 'member' ? (
                <View style={[styles.rol, u.role === 'owner' && { backgroundColor: colors.terraSoft }]}>
                  <Txt style={{ fontSize: 11, fontFamily: fontFamily.bodyBold, color: u.role === 'owner' ? colors.terraInk : colors.seaInk }}>{ROL_ADI()[u.role]}</Txt>
                </View>
              ) : null}
            </Pressable>
          ))
        ) : (
          istekler.map((r) => (
            <View key={r.user_id} style={styles.uye}>
              <Avatar initials={basHarfler(r.display_name)} tone={grupRengi(r.user_id)} size={40} uri={r.avatar_url} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
                  {r.display_name}
                </Txt>
                <Txt variant="small">
                  @{r.username} · {kisaZaman(r.created_at)}
                </Txt>
              </View>
              <IconButton icon="close" label={$t('grup.istegini_reddet', { display_name: r.display_name })} onPress={() => void islem(() => istegiYanitla(grup.id, r.user_id, false))} />
              <Pressable accessibilityRole="button" accessibilityLabel={$t('grup.istegini_onayla', { display_name: r.display_name })} disabled={mesgul} onPress={() => void islem(() => istegiYanitla(grup.id, r.user_id, true))} style={styles.onay}>
                <Txt style={{ color: '#FFFFFF', fontFamily: fontFamily.bodyBold, fontSize: 12 }}>{$t('grup.onayla')}</Txt>
              </Pressable>
            </View>
          ))
        )}
        {hata ? <Txt style={{ color: colors.terraInk }}>{hata}</Txt> : null}
      </View>
      {sikayet.pencere}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  hero: { backgroundColor: colors.sea, paddingHorizontal: space.lg, paddingBottom: 18 },
  title: { fontFamily: fontFamily.displayHeavy, fontSize: 28, color: '#FFFFFF', letterSpacing: -0.6 },
  shortcuts: { flexDirection: 'row', gap: 8, padding: space.lg },
  shortcut: { flex: 1, height: 64, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', gap: 4 },
  kod: { marginHorizontal: space.lg, marginBottom: space.md, padding: 12, borderRadius: 14, backgroundColor: colors.sand, alignItems: 'center' },
  tabs: { flexDirection: 'row', marginHorizontal: space.lg, borderBottomWidth: 1, borderBottomColor: colors.lineStrong },
  tab: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: colors.ink },
  card: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  uye: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 6 },
  rol: { height: 24, paddingHorizontal: 10, borderRadius: 12, backgroundColor: colors.seaSoft, justifyContent: 'center' },
  onay: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.sea, justifyContent: 'center' },
});
