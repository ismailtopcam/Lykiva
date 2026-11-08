import { formatKm } from '@lykiva/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RouteThumb } from '@/components/charts';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { OrnekSohbet } from '@/components/OrnekSohbet';
import { Txt } from '@/components/Txt';
import { Avatar, DateBadge } from '@/components/ui';
import { grupEtkinlikleri, kisaTarih, tarihRozeti, type EtkinlikOzeti } from '@/etkinlik/etkinlikler';
import { basHarfler, grupDetayi, grupRengi, grupRotalari, onizleme, uyeSayisi, type GrupDetayi, type GrupRotasi } from '@/grup/gruplar';
import { useSohbet, type Mesaj } from '@/grup/sohbet';
import { colors, fontFamily, space } from '@/theme';

const uuidMi = (id: string | undefined) => !!id && /^[0-9a-f-]{36}$/i.test(id);

export default function GrupSohbetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return uuidMi(id) ? <GercekSohbet id={id} /> : <OrnekSohbet />;
}

const gunAdi = (iso: string) => {
  const d = new Date(iso);
  const bugun = new Date();
  const g = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const fark = Math.round((g(bugun) - g(d)) / 86_400_000);
  if (fark === 0) return 'Bugün';
  if (fark === 1) return 'Dün';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: d.getFullYear() === bugun.getFullYear() ? undefined : 'numeric' });
};
const saat = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

function GercekSohbet({ id }: { id: string }) {
  const insets = useSafeAreaInsets();
  const { mesajlar, hata, ben, dahaVar, eskileriYukle, gonder, sil } = useSohbet(id);
  const [grup, setGrup] = useState<GrupDetayi | null>(null);
  const [rotalar, setRotalar] = useState<Map<string, GrupRotasi>>(new Map());
  const [etkinlikler, setEtkinlikler] = useState<Map<string, EtkinlikOzeti>>(new Map());
  const [bilinmeyenEtkinlik, setBilinmeyenEtkinlik] = useState<Set<string>>(new Set());
  const [taslak, setTaslak] = useState('');
  const [gonderHatasi, setGonderHatasi] = useState<string | null>(null);
  const kaydirma = useRef<ScrollViewInstance>(null);
  const sonSayi = useRef(0);

  useEffect(() => {
    void grupDetayi(id)
      .then(setGrup)
      .catch(() => undefined);
  }, [id]);

  // Rota kartları için: sohbetteki rota eklerinin özetleri (yeni rota mesajı gelince tazelenir)
  const rotaEkleri = useMemo(() => (mesajlar ?? []).filter((m) => m.attachment_type === 'route' && m.attachment_id).map((m) => m.attachment_id as string), [mesajlar]);
  const eksikRota = rotaEkleri.some((r) => !rotalar.has(r));
  useEffect(() => {
    if (!eksikRota) return;
    void grupRotalari(id)
      .then((l) => setRotalar(new Map(l.map((r) => [r.id, r]))))
      .catch(() => undefined);
  }, [eksikRota, id]);

  // Etkinlik kartları için özetler (yeni etkinlik mesajı gelince tazelenir; silinmiş/eski olanlar bir kez denenir)
  const etkinlikEkleri = useMemo(() => (mesajlar ?? []).filter((m) => m.attachment_type === 'event' && m.attachment_id).map((m) => m.attachment_id as string), [mesajlar]);
  const eksikEtkinlik = etkinlikEkleri.some((e) => !etkinlikler.has(e) && !bilinmeyenEtkinlik.has(e));
  useEffect(() => {
    if (!eksikEtkinlik) return;
    void grupEtkinlikleri(id)
      .then((l) => {
        const m = new Map(l.map((e) => [e.id, e]));
        setEtkinlikler(m);
        setBilinmeyenEtkinlik(new Set(etkinlikEkleri.filter((e) => !m.has(e))));
      })
      .catch(() => undefined);
  }, [eksikEtkinlik, etkinlikEkleri, id]);

  // Yeni mesaj gelince en alta kaydır
  useEffect(() => {
    const n = mesajlar?.length ?? 0;
    if (n > sonSayi.current) setTimeout(() => kaydirma.current?.scrollToEnd({ animated: sonSayi.current > 0 }), 50);
    sonSayi.current = n;
  }, [mesajlar]);

  async function yolla() {
    const t = taslak.trim();
    if (!t) return;
    setTaslak('');
    setGonderHatasi(null);
    try {
      await gonder(t);
    } catch (e) {
      setTaslak(t);
      setGonderHatasi(e instanceof Error ? e.message : 'Gönderilemedi');
    }
  }

  function mesajSecenekleri(m: Mesaj) {
    const yonetici = grup?.my_role === 'owner' || grup?.my_role === 'admin';
    if (m.bekliyor || (m.sender_id !== ben && !yonetici)) return;
    Alert.alert('Mesaj', undefined, [
      { text: 'Sil', style: 'destructive', onPress: () => void sil(m.id).catch((e: unknown) => Alert.alert('Silinemedi', e instanceof Error ? e.message : String(e))) },
      { text: 'Vazgeç', style: 'cancel' },
    ]);
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <IconButton icon="back" label="Geri" onPress={() => router.back()} />
        <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/grup/[id]', params: { id } })} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Avatar initials={basHarfler(grup?.name ?? '…')} tone={grupRengi(id)} square />
          <View style={{ flex: 1 }}>
            <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 16 }} numberOfLines={1}>
              {grup?.name ?? 'Sohbet'}
            </Txt>
            {grup ? <Txt variant="small">{uyeSayisi(grup.member_count)}</Txt> : null}
          </View>
        </Pressable>
        <IconButton icon="pin" label="Canlı haritayı aç" onPress={() => router.push({ pathname: '/canli-harita', params: { grup: id } })} />
      </View>

      <ScrollView ref={kaydirma} contentContainerStyle={{ padding: 12, gap: 6 }}>
        {dahaVar ? (
          <Pressable accessibilityRole="button" onPress={() => void eskileriYukle()} style={{ alignSelf: 'center', padding: 8 }}>
            <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.seaInk }}>Daha eski mesajlar</Txt>
          </Pressable>
        ) : null}
        {mesajlar === null && !hata ? <ActivityIndicator color={colors.terra} style={{ marginTop: space.lg }} /> : null}
        {hata ? <Txt style={{ color: colors.terraInk, textAlign: 'center' }}>{hata}</Txt> : null}
        {mesajlar && mesajlar.length === 0 ? (
          <Txt variant="muted" style={{ textAlign: 'center', marginTop: space.lg }}>
            Henüz mesaj yok. İlk mesajı sen yaz.
          </Txt>
        ) : null}
        {mesajlar?.map((m, i) => {
          const onceki = mesajlar[i - 1];
          const yeniGun = !onceki || gunAdi(onceki.created_at) !== gunAdi(m.created_at);
          const benim = m.sender_id === ben;
          const adGoster = !benim && (yeniGun || onceki?.sender_id !== m.sender_id);
          const rota = m.attachment_type === 'route' && m.attachment_id ? rotalar.get(m.attachment_id) : undefined;
          const etkinlik = m.attachment_type === 'event' && m.attachment_id ? etkinlikler.get(m.attachment_id) : undefined;
          return (
            <View key={m.id}>
              {yeniGun ? (
                <Txt variant="caption" style={{ textAlign: 'center', marginVertical: 8 }}>
                  {gunAdi(m.created_at)}
                </Txt>
              ) : null}
              <Pressable
                onLongPress={() => mesajSecenekleri(m)}
                accessibilityLabel={`${benim ? 'Sen' : (m.ad ?? 'Üye')}, ${saat(m.created_at)}: ${m.attachment_type === 'route' ? 'rota paylaştı. ' : m.attachment_type === 'event' ? `etkinlik oluşturdu: ${etkinlik?.title ?? ''}. ` : ''}${m.body ?? ''}`}
                style={[styles.satir, benim && { justifyContent: 'flex-end' }]}>
                {!benim ? (
                  <View style={{ width: 28 }}>{adGoster ? <Avatar initials={basHarfler(m.ad ?? '?')} tone={grupRengi(m.sender_id)} size={28} /> : null}</View>
                ) : null}
                <View style={{ maxWidth: 270 }}>
                  {adGoster ? (
                    <Txt variant="small" style={{ marginLeft: 4, marginBottom: 3 }}>
                      {m.ad ?? 'Üye'}
                    </Txt>
                  ) : null}
                  {m.attachment_type === 'event' ? (
                    <Pressable
                      accessibilityRole="link"
                      onPress={() => m.attachment_id && router.push({ pathname: '/etkinlik/[id]', params: { id: m.attachment_id } })}
                      style={[styles.balonGelen, { width: 250, flexDirection: 'row', gap: 10, alignItems: 'center' }, benim && { borderColor: colors.terra }]}>
                      {etkinlik ? <DateBadge month={tarihRozeti(etkinlik.starts_at).ay} day={tarihRozeti(etkinlik.starts_at).gun} /> : <Icon name="calendar" color={colors.terra} />}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Txt variant="small">Etkinlik</Txt>
                        <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 14 }} numberOfLines={2}>
                          {etkinlik?.title ?? 'Etkinlik'}
                        </Txt>
                        {etkinlik ? (
                          <Txt variant="small">
                            {kisaTarih(etkinlik.starts_at)} · {etkinlik.going_count} kişi
                          </Txt>
                        ) : null}
                      </View>
                    </Pressable>
                  ) : m.attachment_type === 'route' ? (
                    <Pressable
                      accessibilityRole="link"
                      onPress={() => m.attachment_id && router.push({ pathname: '/rota/[id]', params: { id: m.attachment_id } })}
                      style={[benim ? styles.balonGiden : styles.balonGelen, { padding: 0, width: 240, overflow: 'hidden' }]}>
                      {rota?.preview && rota.preview.length > 1 ? (
                        <View style={{ backgroundColor: colors.surface }}>
                          <RouteThumb route={onizleme(rota.preview)} size={240} height={100} color={colors.sea} />
                        </View>
                      ) : null}
                      <View style={{ padding: 12, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        <Icon name="route" size={18} color={benim ? '#FFFFFF' : colors.seaInk} />
                        <View style={{ flex: 1 }}>
                          <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 14, color: benim ? '#FFFFFF' : colors.ink }} numberOfLines={1}>
                            {rota?.name ?? 'Rota'}
                          </Txt>
                          {rota ? (
                            <Txt style={{ fontSize: 12, color: benim ? '#F6E3D9' : colors.inkMuted }}>
                              {formatKm(rota.distance_m)} km{rota.elevation_gain_m != null ? ` · ↑ ${Math.round(rota.elevation_gain_m)} m` : ''}
                            </Txt>
                          ) : null}
                        </View>
                      </View>
                      {m.body ? <Txt style={[styles.metin, { paddingHorizontal: 12, paddingBottom: 12 }, benim && { color: '#FFFFFF' }]}>{m.body}</Txt> : null}
                    </Pressable>
                  ) : (
                    <View style={[benim ? styles.balonGiden : styles.balonGelen, m.bekliyor && { opacity: 0.6 }]}>
                      <Txt style={[styles.metin, benim && { color: '#FFFFFF' }]}>{m.body}</Txt>
                    </View>
                  )}
                  <Txt style={[styles.saat, benim && { textAlign: 'right' }]}>{m.bekliyor ? 'gönderiliyor…' : saat(m.created_at)}</Txt>
                </View>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      {gonderHatasi ? (
        <Txt accessibilityRole="alert" style={{ color: colors.terraInk, paddingHorizontal: space.lg, paddingBottom: 4 }}>
          {gonderHatasi}
        </Txt>
      ) : null}
      <View style={[styles.composer, { paddingBottom: insets.bottom + 10 }]}>
        <IconButton icon="route" label="Rota paylaş" onPress={() => router.push({ pathname: '/grup/[id]/rota-paylas', params: { id } })} style={{ backgroundColor: colors.ground }} />
        <TextInput
          value={taslak}
          onChangeText={setTaslak}
          onSubmitEditing={() => void yolla()}
          placeholder="Mesaj yaz…"
          placeholderTextColor={colors.inkMuted}
          accessibilityLabel="Mesaj"
          returnKeyType="send"
          maxLength={4000}
          style={styles.input}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Gönder" onPress={() => void yolla()} disabled={!taslak.trim()} style={[styles.send, !taslak.trim() && { opacity: 0.5 }]}>
          <Icon name="send" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: space.sm, paddingBottom: 8, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line },
  satir: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  balonGelen: { padding: 12, borderRadius: 16, borderBottomLeftRadius: 4, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  balonGiden: { padding: 12, borderRadius: 16, borderBottomRightRadius: 4, backgroundColor: colors.terra },
  metin: { fontSize: 14, lineHeight: 20, color: colors.ink },
  saat: { fontSize: 10, color: colors.inkMuted, marginTop: 2, marginHorizontal: 4 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingTop: 8, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line },
  input: { flex: 1, height: 44, borderRadius: 22, backgroundColor: colors.ground, paddingHorizontal: 14, fontFamily: fontFamily.body, fontSize: 14, color: colors.ink },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.terra, alignItems: 'center', justifyContent: 'center' },
});
