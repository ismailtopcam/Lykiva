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
import { Txt } from '@/components/Txt';
import { Avatar, Button, DateBadge } from '@/components/ui';
import { grupEtkinlikleri, kisaTarih, tarihRozeti, type EtkinlikOzeti } from '@/etkinlik/etkinlikler';
import {
  basHarfler,
  bekleyenIstekler,
  davetKoduYenile,
  davetMetni,
  grubaKatil,
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

const uuidMi = (id: string | undefined) => !!id && /^[0-9a-f-]{36}$/i.test(id);

export default function GrupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return uuidMi(id) ? <GercekGrup id={id} /> : <OrnekGrup />;
}

type Sekme = 'etkinlikler' | 'rotalar' | 'uyeler' | 'istekler';

function GercekGrup({ id }: { id: string }) {
  const insets = useSafeAreaInsets();
  const hesap = useHesap();
  const [g, setG] = useState<GrupDetayi | null | undefined>(undefined);
  const [uyeler, setUyeler] = useState<Uye[]>([]);
  const [rotalar, setRotalar] = useState<GrupRotasi[]>([]);
  const [istekler, setIstekler] = useState<Istek[]>([]);
  const [etkinlikler, setEtkinlikler] = useState<EtkinlikOzeti[]>([]);
  // Geçmiş etkinlikleri soluk göstermek için yükleme anı (render sırasında saat okunmaz)
  const [yuklenme, setYuklenme] = useState(0);
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
      const [u, r, i, e] = await Promise.all([
        grupUyeleri(id),
        uye ? grupRotalari(id) : Promise.resolve([]),
        yonetici ? bekleyenIstekler(id) : Promise.resolve([]),
        uye ? grupEtkinlikleri(id).catch(() => []) : Promise.resolve([]),
      ]);
      setUyeler(u);
      setRotalar(r);
      setIstekler(i);
      setEtkinlikler(e);
      setYuklenme(Date.now());
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Grup yüklenemedi');
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
        {g === undefined ? <ActivityIndicator color={colors.terra} /> : <Txt variant="muted">{hata ?? 'Grup bulunamadı ya da özel bir grup.'}</Txt>}
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
      Alert.alert('Yapılamadı', e instanceof Error ? e.message : String(e));
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
        text: 'Davet kodunu yenile',
        onPress: () =>
          void islem(async () => {
            const k = await davetKoduYenile(grup.id);
            Alert.alert('Yeni davet kodu', `${k}\nEski kod artık çalışmaz.`);
          }),
      });
    secenekler.push({
      text: 'Gruptan ayrıl',
      style: 'destructive',
      onPress: () =>
        Alert.alert(
          'Gruptan ayrılınsın mı?',
          sahip
            ? grup.member_count > 1
              ? 'Grup sahibisin; sahiplik bir yöneticiye, yoksa en eski üyeye geçer.'
              : 'Gruptaki son kişisin; ayrılırsan grup ve mesajları silinir.'
            : 'Tekrar katılmak için davet ya da onay gerekebilir.',
          [
            { text: 'Vazgeç', style: 'cancel' },
            {
              text: 'Ayrıl',
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
    secenekler.push({ text: 'Vazgeç', style: 'cancel' });
    Alert.alert(grup.name, undefined, secenekler);
  }

  function uyeSecenekleri(u: Uye) {
    if (!yonetici || u.user_id === hesap?.id || u.role === 'owner') return;
    const secenekler: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] = [];
    if (sahip) {
      secenekler.push(
        u.role === 'admin'
          ? { text: 'Yöneticilikten al', onPress: () => void islem(() => uyeRoluDegistir(grup.id, u.user_id, false)) }
          : { text: 'Yönetici yap', onPress: () => void islem(() => uyeRoluDegistir(grup.id, u.user_id, true)) },
      );
    }
    if (sahip || u.role === 'member') {
      secenekler.push({ text: 'Gruptan çıkar', style: 'destructive', onPress: () => void islem(() => uyeCikar(grup.id, u.user_id)) });
    }
    secenekler.push({ text: 'Vazgeç', style: 'cancel' });
    Alert.alert(u.display_name, ROL_ADI[u.role], secenekler);
  }

  const kisayollar: { label: string; icon: IconName; onPress: () => void; dark?: boolean }[] = uye
    ? [
        { label: 'Sohbet', icon: 'chat', dark: true, onPress: () => router.push({ pathname: '/grup/[id]/sohbet', params: { id: grup.id } }) },
        { label: 'Etkinlik', icon: 'calendar', onPress: () => router.push({ pathname: '/etkinlik/olustur', params: { grup: grup.id } }) },
        { label: 'Rota paylaş', icon: 'route', onPress: () => router.push({ pathname: '/grup/[id]/rota-paylas', params: { id: grup.id } }) },
        ...(yonetici ? [{ label: 'Davet et', icon: 'share' as IconName, onPress: () => void davetEt() }] : []),
      ]
    : [];

  const sekmeler: { id: Sekme; ad: string }[] = [
    ...(uye ? [{ id: 'etkinlikler' as Sekme, ad: 'Etkinlikler' }, { id: 'rotalar' as Sekme, ad: 'Rotalar' }] : []),
    { id: 'uyeler', ad: `Üyeler (${grup.member_count})` },
    ...(yonetici && grup.pending_count > 0 ? [{ id: 'istekler' as Sekme, ad: `İstekler (${grup.pending_count})` }] : []),
  ];
  const aktifSekme = sekmeler.some((s) => s.id === sekme) ? sekme : sekmeler[0].id;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
      <View style={[styles.hero, { paddingTop: insets.top + 6 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: -8 }}>
          <IconButton icon="back" label="Geri" color="#FFFFFF" onPress={() => router.back()} />
          {uye ? <IconButton icon="more" label="Grup seçenekleri" color="#FFFFFF" onPress={ayarlar} /> : null}
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
          {uyeSayisi(grup.member_count)} · {grup.is_private ? 'Özel grup' : grup.requires_approval ? 'Açık · onaylı katılım' : 'Açık topluluk'}
          {grup.my_role ? ` · ${ROL_ADI[grup.my_role]}` : ''}
        </Txt>
        {grup.description ? <Txt style={{ fontSize: 14, lineHeight: 20, color: '#FFFFFF', marginTop: 10 }}>{grup.description}</Txt> : null}
      </View>

      {!uye ? (
        <View style={{ padding: space.lg, gap: space.sm }}>
          <Button
            label={mesgul ? '…' : grup.requested ? 'İsteği geri al' : grup.requires_approval ? 'Katılma isteği gönder' : 'Topluluğa katıl'}
            icon={grup.requested ? 'close' : 'users'}
            variant={grup.requested ? 'outline' : 'primary'}
            disabled={mesgul}
            onPress={() => void islem(() => (grup.requested ? istegiGeriAl(grup.id) : grubaKatil(grup.id)))}
          />
          {grup.requested ? <Txt variant="small">İsteğin yöneticilere iletildi; onaylanınca grubun sohbetini ve rotalarını görürsün.</Txt> : null}
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
        <Pressable accessibilityRole="button" accessibilityLabel={`Davet kodu ${grup.invite_code.split('').join(' ')}. Paylaş`} onPress={() => void davetEt()} style={styles.kod}>
          <Txt variant="small">Davet kodu</Txt>
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
            <Txt variant="muted">Planlanmış etkinlik yok. “Etkinlik” ile bir buluşma ayarla.</Txt>
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
                      {kisaTarih(e.starts_at)} · {e.going_count}
                      {e.capacity ? `/${e.capacity}` : ''} kişi
                    </Txt>
                  </View>
                  {e.my_status === 'going' ? (
                    <View style={[styles.rol, { backgroundColor: colors.terraSoft }]}>
                      <Txt style={{ fontSize: 11, fontFamily: fontFamily.bodyBold, color: colors.terraInk }}>Gidiyorsun</Txt>
                    </View>
                  ) : null}
                </Pressable>
              );
            })
          )
        ) : aktifSekme === 'rotalar' ? (
          rotalar.length === 0 ? (
            <Txt variant="muted">Gruba henüz rota paylaşılmadı. Kendi rotalarından birini “Rota paylaş” ile ekleyebilirsin.</Txt>
          ) : (
            rotalar.map((r) => (
              <Pressable key={r.id} accessibilityRole="link" onPress={() => router.push({ pathname: '/rota/[id]', params: { id: r.id } })} style={styles.card}>
                {r.preview && r.preview.length > 1 ? <RouteThumb route={onizleme(r.preview)} size={56} color={colors.sea} /> : <View style={{ width: 56, height: 56 }} />}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
                    {r.name}
                  </Txt>
                  <Txt variant="small">
                    {formatKm(r.distance_m)} km{r.elevation_gain_m != null ? ` · ↑ ${Math.round(r.elevation_gain_m)} m` : ''}
                  </Txt>
                  <Txt variant="small">
                    {r.owner_name} · {kisaZaman(r.shared_at)}
                  </Txt>
                </View>
              </Pressable>
            ))
          )
        ) : aktifSekme === 'uyeler' ? (
          uyeler.map((u) => (
            <Pressable
              key={u.user_id}
              accessibilityRole={yonetici && u.role !== 'owner' && u.user_id !== hesap?.id ? 'button' : 'text'}
              onPress={() => uyeSecenekleri(u)}
              disabled={mesgul}
              style={styles.uye}>
              <Avatar initials={basHarfler(u.display_name)} tone={grupRengi(u.user_id)} size={40} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
                  {u.display_name}
                  {u.user_id === hesap?.id ? ' (sen)' : ''}
                </Txt>
                <Txt variant="small">@{u.username}</Txt>
              </View>
              {u.role !== 'member' ? (
                <View style={[styles.rol, u.role === 'owner' && { backgroundColor: colors.terraSoft }]}>
                  <Txt style={{ fontSize: 11, fontFamily: fontFamily.bodyBold, color: u.role === 'owner' ? colors.terraInk : colors.seaInk }}>{ROL_ADI[u.role]}</Txt>
                </View>
              ) : null}
            </Pressable>
          ))
        ) : (
          istekler.map((r) => (
            <View key={r.user_id} style={styles.uye}>
              <Avatar initials={basHarfler(r.display_name)} tone={grupRengi(r.user_id)} size={40} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
                  {r.display_name}
                </Txt>
                <Txt variant="small">
                  @{r.username} · {kisaZaman(r.created_at)}
                </Txt>
              </View>
              <IconButton icon="close" label={`${r.display_name} isteğini reddet`} onPress={() => void islem(() => istegiYanitla(grup.id, r.user_id, false))} />
              <Pressable accessibilityRole="button" accessibilityLabel={`${r.display_name} isteğini onayla`} disabled={mesgul} onPress={() => void islem(() => istegiYanitla(grup.id, r.user_id, true))} style={styles.onay}>
                <Txt style={{ color: '#FFFFFF', fontFamily: fontFamily.bodyBold, fontSize: 12 }}>Onayla</Txt>
              </Pressable>
            </View>
          ))
        )}
        {hata ? <Txt style={{ color: colors.terraInk }}>{hata}</Txt> : null}
      </View>
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
