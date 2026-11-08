import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { OrnekGruplar } from '@/components/OrnekGruplar';
import { Txt } from '@/components/Txt';
import { Avatar, Button, DateBadge, SectionHeader } from '@/components/ui';
import { kisaTarih, tarihRozeti, yaklasanEtkinlikler, type EtkinlikOzeti } from '@/etkinlik/etkinlikler';
import {
  basHarfler,
  davetleKatil,
  grubaKatil,
  grupEtiketi,
  grupRengi,
  gruplarim,
  istegiGeriAl,
  kesfetGruplar,
  kisaZaman,
  uyeSayisi,
  type GrupOzeti,
  type KesfetGrubu,
} from '@/grup/gruplar';
import { supabaseHazir } from '@/lib/supabase';
import { colors, fontFamily, space } from '@/theme';

/** Sunucu anahtarı yoksa tasarım örneği, varsa gerçek gruplar */
export default function GruplarScreen() {
  return supabaseHazir ? <GercekGruplar /> : <OrnekGruplar />;
}

function sonMesaj(g: GrupOzeti) {
  if (!g.last_message_at) return `${grupEtiketi(g)} · ${uyeSayisi(g.member_count)}${g.is_private ? ' · Özel' : ''}`;
  const icerik = g.last_message_type === 'route' ? 'bir rota paylaştı' : g.last_message_type === 'event' ? 'bir etkinlik oluşturdu' : (g.last_message ?? '');
  return `${g.last_sender ? g.last_sender + ': ' : ''}${icerik}`;
}

function GercekGruplar() {
  const [benim, setBenim] = useState<GrupOzeti[] | null>(null);
  const [kesfet, setKesfet] = useState<KesfetGrubu[] | null>(null);
  const [etkinlikler, setEtkinlikler] = useState<EtkinlikOzeti[]>([]);
  const [arama, setArama] = useState('');
  const [kod, setKod] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [bekleyen, setBekleyen] = useState<string | null>(null);

  const yukle = useCallback(async (q?: string) => {
    try {
      setHata(null);
      const [b, k, e] = await Promise.all([gruplarim(), kesfetGruplar(q), yaklasanEtkinlikler().catch(() => [])]);
      setBenim(b);
      setKesfet(k);
      setEtkinlikler(e);
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Gruplar yüklenemedi');
      setBenim((x) => x ?? []);
      setKesfet((x) => x ?? []);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  async function koddanKatil() {
    if (!kod.trim()) return;
    setBekleyen('kod');
    setHata(null);
    try {
      const id = await davetleKatil(kod);
      setKod('');
      router.push({ pathname: '/grup/[id]', params: { id } });
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Katılınamadı');
    } finally {
      setBekleyen(null);
    }
  }

  async function katil(g: KesfetGrubu) {
    setBekleyen(g.id);
    setHata(null);
    try {
      if (g.requested) await istegiGeriAl(g.id);
      else {
        const s = await grubaKatil(g.id);
        if (s === 'uye') {
          router.push({ pathname: '/grup/[id]', params: { id: g.id } });
        }
      }
      await yukle(arama);
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'İşlem yapılamadı');
    } finally {
      setBekleyen(null);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Txt variant="display" accessibilityRole="header">
            Gruplar
          </Txt>
          <Pressable accessibilityRole="button" onPress={() => router.push('/grup/olustur')} style={styles.newBtn}>
            <Icon name="plus" size={16} strokeWidth={2.2} />
            <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 13 }}>Yeni grup</Txt>
          </Pressable>
        </View>

        <View style={styles.kod}>
          <Icon name="link" size={18} color={colors.inkMuted} />
          <TextInput
            value={kod}
            onChangeText={setKod}
            onSubmitEditing={() => void koddanKatil()}
            placeholder="Davet koduyla katıl"
            placeholderTextColor={colors.inkMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="go"
            accessibilityLabel="Davet kodu"
            style={styles.kodInput}
          />
          <Pressable accessibilityRole="button" onPress={() => void koddanKatil()} disabled={!kod.trim() || !!bekleyen} style={[styles.kodBtn, !kod.trim() && { opacity: 0.4 }]}>
            {bekleyen === 'kod' ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Txt style={{ color: '#FFFFFF', fontFamily: fontFamily.bodyBold, fontSize: 13 }}>Katıl</Txt>}
          </Pressable>
        </View>

        {hata ? (
          <Txt accessibilityRole="alert" style={{ color: colors.terraInk, marginBottom: space.md }}>
            {hata}
          </Txt>
        ) : null}

        {etkinlikler.length ? (
          <View style={{ marginBottom: space.lg }}>
            <SectionHeader title="Yaklaşan etkinlikler" />
            {etkinlikler.slice(0, 3).map((e) => {
              const r = tarihRozeti(e.starts_at);
              return (
                <Pressable key={e.id} accessibilityRole="link" onPress={() => router.push({ pathname: '/etkinlik/[id]', params: { id: e.id } })} style={styles.next}>
                  <DateBadge month={r.ay} day={r.gun} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 15 }} numberOfLines={1}>
                      {e.title}
                    </Txt>
                    <Txt variant="small" numberOfLines={1}>
                      {kisaTarih(e.starts_at)}
                      {e.group_name ? ` · ${e.group_name}` : ''} · {e.going_count} kişi
                      {e.my_status === 'going' ? ' · gidiyorsun' : e.my_status === 'waitlist' ? ' · bekleme listesi' : ''}
                    </Txt>
                  </View>
                  <Icon name="chevron" size={20} color={colors.inkMuted} strokeWidth={2} />
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <SectionHeader title="Grupların ve toplulukların" />
        {benim === null ? <ActivityIndicator color={colors.terra} style={{ marginVertical: space.lg }} /> : null}
        {benim && benim.length === 0 ? (
          <Txt variant="muted" style={{ paddingVertical: space.md }}>
            Henüz bir grubun yok. Yeni bir grup kur, davet koduyla katıl ya da aşağıdan bir topluluğa katıl.
          </Txt>
        ) : null}
        {benim?.map((g) => (
          <Pressable
            key={g.id}
            accessibilityRole="link"
            accessibilityLabel={`${g.name}${g.unread ? `, ${g.unread} okunmamış mesaj` : ''}`}
            onPress={() => router.push({ pathname: '/grup/[id]', params: { id: g.id } })}
            style={styles.row}>
            <Avatar initials={basHarfler(g.name)} tone={grupRengi(g.id)} size={48} square />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15, flexShrink: 1 }} numberOfLines={1}>
                  {g.name}
                </Txt>
                <Txt variant="small">{kisaZaman(g.last_message_at)}</Txt>
              </View>
              <Txt variant="small" numberOfLines={1}>
                {sonMesaj(g)}
              </Txt>
            </View>
            {g.unread ? (
              <View style={styles.badge}>
                <Txt style={{ color: '#FFFFFF', fontFamily: fontFamily.bodyBold, fontSize: 11 }}>{g.unread > 99 ? '99+' : g.unread}</Txt>
              </View>
            ) : null}
          </Pressable>
        ))}

        <View style={{ marginTop: space.lg }}>
          <Button label="Etkinlik oluştur" icon="calendar" variant="outline" href="/etkinlik/olustur" />
        </View>

        <View style={{ marginTop: space.xl }}>
          <SectionHeader title="Toplulukları keşfet" />
        </View>
        <View style={styles.ara}>
          <Icon name="search" size={18} color={colors.inkMuted} strokeWidth={2} />
          <TextInput
            value={arama}
            onChangeText={setArama}
            onSubmitEditing={() => void yukle(arama)}
            placeholder="Ad ya da şehir ara"
            placeholderTextColor={colors.inkMuted}
            returnKeyType="search"
            accessibilityLabel="Topluluk ara"
            style={styles.kodInput}
          />
        </View>
        {kesfet && kesfet.length === 0 ? (
          <Txt variant="muted" style={{ paddingVertical: space.md }}>
            {arama.trim() ? 'Aramana uyan açık topluluk yok.' : 'Şimdilik katılabileceğin açık topluluk yok. İlkini sen kur!'}
          </Txt>
        ) : null}
        {kesfet?.map((g) => (
          <View key={g.id} style={styles.row}>
            <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/grup/[id]', params: { id: g.id } })} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <Avatar initials={basHarfler(g.name)} tone={grupRengi(g.id)} size={44} square />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
                  {g.name}
                </Txt>
                <Txt variant="small" numberOfLines={1}>
                  {grupEtiketi(g)} · {uyeSayisi(g.member_count)}
                  {g.requires_approval ? ' · Onaylı katılım' : ''}
                </Txt>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={g.requested ? `${g.name}: isteği geri al` : `${g.name} topluluğuna katıl`}
              onPress={() => void katil(g)}
              disabled={!!bekleyen}
              style={[styles.katil, g.requested && styles.katilPasif]}>
              {bekleyen === g.id ? (
                <ActivityIndicator size="small" color={g.requested ? colors.ink : '#FFFFFF'} />
              ) : (
                <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 12, color: g.requested ? colors.ink : '#FFFFFF' }}>
                  {g.requested ? 'İstek gönderildi' : g.requires_approval ? 'İstek gönder' : 'Katıl'}
                </Txt>
              )}
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.lg },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, borderColor: colors.ink },
  kod: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingLeft: 14, paddingRight: 4, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, marginBottom: space.lg },
  kodInput: { flex: 1, fontFamily: fontFamily.body, fontSize: 14, color: colors.ink, height: 44 },
  kodBtn: { height: 40, minWidth: 64, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  ara: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, marginBottom: space.sm },
  next: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.lineStrong },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.terra, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  katil: { height: 36, minWidth: 64, paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.sea, alignItems: 'center', justifyContent: 'center' },
  katilPasif: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.lineStrong },
});
