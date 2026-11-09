import { ACTIVITY_LABELS, DIFFICULTY_LABELS, formatKm, formatMeters } from '@lykiva/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { kisiAra, simdikiKonum, type KisiOzeti } from '@/akis/akis';
import { RouteThumb } from '@/components/charts';
import { Icon } from '@/components/Icon';
import { KisiSatiri } from '@/components/KisiSatiri';
import { OrnekKesfet } from '@/components/OrnekKesfet';
import { Txt } from '@/components/Txt';
import { Avatar, Button, Chip, DateBadge, SectionHeader } from '@/components/ui';
import type { LngLat } from '@/data/ornek';
import { kisaTarih, tarihRozeti } from '@/etkinlik/etkinlikler';
import { basHarfler, grubaKatil, grupEtiketi, grupRengi, istegiGeriAl, kesfetGruplar, onizleme, uyeSayisi, type KesfetGrubu } from '@/grup/gruplar';
import { izinliKonum, kesfetEtkinlikler, kesfetRotalar, uzaklikMetni, type KesfetEtkinligi, type KesfetRotasi } from '@/kesfet/kesfet';
import { supabaseHazir } from '@/lib/supabase';
import { colors, fontFamily, space } from '@/theme';

/** Sunucu anahtarı yoksa tasarım örneği, varsa gerçek Keşfet */
export default function KesfetScreen() {
  return supabaseHazir ? <GercekKesfet /> : <OrnekKesfet />;
}

type Sekme = 'tumu' | 'rotalar' | 'topluluklar' | 'etkinlikler' | 'kisiler';
const SEKMELER: { k: Sekme; ad: string }[] = [
  { k: 'tumu', ad: 'Tümü' },
  { k: 'rotalar', ad: 'Rotalar' },
  { k: 'topluluklar', ad: 'Topluluklar' },
  { k: 'etkinlikler', ad: 'Etkinlikler' },
  { k: 'kisiler', ad: 'Kişiler' },
];

type Veri = { rotalar: KesfetRotasi[]; etkinlikler: KesfetEtkinligi[]; gruplar: KesfetGrubu[]; kisiler: KisiOzeti[] };

function GercekKesfet() {
  const [sekme, setSekme] = useState<Sekme>('tumu');
  const [arama, setArama] = useState('');
  const [veri, setVeri] = useState<Veri | null>(null);
  const [konum, setKonum] = useState<LngLat | null>(null);
  const [konumSoruldu, setKonumSoruldu] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [bekleyen, setBekleyen] = useState<string | null>(null);
  const istekNo = useRef(0);

  const yukle = useCallback(async (q: string, k: LngLat | null) => {
    const no = ++istekNo.current;
    try {
      const kisaArama = q.trim().length === 1;
      const [rotalar, etkinlikler, gruplar, kisiler] = await Promise.all([
        kesfetRotalar(kisaArama ? '' : q, k),
        kesfetEtkinlikler(kisaArama ? '' : q, k).catch(() => [] as KesfetEtkinligi[]),
        kesfetGruplar(kisaArama ? undefined : q).catch(() => [] as KesfetGrubu[]),
        q.trim().length >= 2 ? kisiAra(q).catch(() => [] as KisiOzeti[]) : Promise.resolve([] as KisiOzeti[]),
      ]);
      if (no !== istekNo.current) return;
      setHata(null);
      setVeri({ rotalar, etkinlikler, gruplar, kisiler });
    } catch (e) {
      if (no !== istekNo.current) return;
      setHata(e instanceof Error ? e.message : 'Keşfet yüklenemedi');
      setVeri((x) => x ?? { rotalar: [], etkinlikler: [], gruplar: [], kisiler: [] });
    }
  }, []);

  // İlk açılış: izin zaten verilmişse konumla (izin istemeden)
  useFocusEffect(
    useCallback(() => {
      if (istekNo.current) return;
      void (async () => {
        const k = await izinliKonum();
        setKonum(k);
        await yukle('', k);
      })();
    }, [yukle]),
  );

  // Aramada kısa bekleme
  const ilkArama = useRef(true);
  useEffect(() => {
    if (ilkArama.current) {
      ilkArama.current = false;
      return;
    }
    const t = setTimeout(() => void yukle(arama, konum), 350);
    return () => clearTimeout(t);
  }, [arama, konum, yukle]);

  async function konumIste() {
    setKonumSoruldu(true);
    const k = await simdikiKonum().catch(() => null);
    if (k) setKonum(k);
  }

  async function yenile() {
    setYenileniyor(true);
    await yukle(arama, konum);
    setYenileniyor(false);
  }

  async function katil(g: KesfetGrubu) {
    setBekleyen(g.id);
    try {
      if (g.requested) await istegiGeriAl(g.id);
      else if ((await grubaKatil(g.id)) === 'uye') {
        router.push({ pathname: '/grup/[id]', params: { id: g.id } });
      }
      await yukle(arama, konum);
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'İşlem yapılamadı');
    } finally {
      setBekleyen(null);
    }
  }

  const goster = (s: Sekme) => sekme === 'tumu' || sekme === s;
  const sinir = (n: number) => (sekme === 'tumu' ? n : 30);
  const araniyor = arama.trim().length >= 2;

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={yenileniyor} onRefresh={() => void yenile()} tintColor={colors.terra} />}>
        <View style={styles.head}>
          <Txt variant="display" accessibilityRole="header">
            Keşfet
          </Txt>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/grup/olustur', params: { tur: 'acik' } })} style={styles.newBtn}>
            <Icon name="plus" size={16} strokeWidth={2.2} />
            <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 13 }}>Topluluk kur</Txt>
          </Pressable>
        </View>
        <View style={styles.search}>
          <Icon name="search" size={18} color={colors.inkMuted} strokeWidth={2} />
          <TextInput
            value={arama}
            onChangeText={setArama}
            placeholder="Rota, topluluk, etkinlik, kişi"
            placeholderTextColor={colors.inkMuted}
            accessibilityLabel="Keşfet'te ara"
            autoCorrect={false}
            returnKeyType="search"
            style={styles.searchInput}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" contentContainerStyle={styles.tabs}>
          {SEKMELER.map((t) => (
            <Chip key={t.k} label={t.ad} role="tab" selected={t.k === sekme} onPress={() => setSekme(t.k)} />
          ))}
        </ScrollView>

        {!konum && !konumSoruldu ? (
          <Pressable accessibilityRole="button" onPress={() => void konumIste()} style={styles.konum}>
            <Icon name="pin" size={18} color={colors.seaInk} />
            <Txt style={{ flex: 1, fontSize: 13, color: colors.seaInk, fontFamily: fontFamily.bodySemiBold }}>Yakınındakileri önce göster</Txt>
            <Icon name="chevron" size={16} color={colors.seaInk} strokeWidth={2} />
          </Pressable>
        ) : null}

        {hata ? (
          <Txt accessibilityRole="alert" style={{ color: colors.terraInk, paddingHorizontal: space.lg, marginBottom: space.md }}>
            {hata}
          </Txt>
        ) : null}
        {veri === null ? <ActivityIndicator color={colors.terra} style={{ marginVertical: space.xl }} /> : null}

        {veri && goster('etkinlikler') ? (
          <Bolum
            baslik={konum ? 'Yakınında yaklaşan etkinlikler' : 'Yaklaşan etkinlikler'}
            tumu={sekme === 'tumu' && veri.etkinlikler.length > 3 ? () => setSekme('etkinlikler') : undefined}
            bos={veri.etkinlikler.length === 0 ? (araniyor ? 'Bu aramayla etkinlik yok.' : 'Önümüzdeki 30 günde görebileceğin etkinlik yok.') : null}>
            {sekme === 'tumu' ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.lg, gap: 10 }}>
                {veri.etkinlikler.slice(0, 8).map((e, i) => (
                  <EtkinlikKarti key={e.id} e={e} koyu={i === 0} />
                ))}
              </ScrollView>
            ) : (
              <View style={{ paddingHorizontal: space.lg, gap: 10 }}>
                {veri.etkinlikler.map((e) => (
                  <EtkinlikKarti key={e.id} e={e} genis />
                ))}
              </View>
            )}
          </Bolum>
        ) : null}

        {veri && goster('rotalar') ? (
          <Bolum
            baslik={konum ? 'Yakınındaki rotalar' : 'Yeni paylaşılan rotalar'}
            tumu={sekme === 'tumu' && veri.rotalar.length > 4 ? () => setSekme('rotalar') : undefined}
            bos={veri.rotalar.length === 0 ? (araniyor ? 'Bu adla rota yok.' : 'Henüz herkese açık rota paylaşılmamış.') : null}>
            <View style={{ paddingHorizontal: space.lg, gap: space.sm }}>
              {veri.rotalar.slice(0, sinir(4)).map((r) => (
                <RotaSatiri key={r.id} r={r} />
              ))}
            </View>
          </Bolum>
        ) : null}

        {veri && goster('topluluklar') ? (
          <Bolum
            baslik={araniyor ? 'Topluluklar' : 'Katılabileceğin topluluklar'}
            tumu={sekme === 'tumu' && veri.gruplar.length > 4 ? () => setSekme('topluluklar') : undefined}
            bos={veri.gruplar.length === 0 ? (araniyor ? 'Bu adla topluluk yok.' : 'Şimdilik katılabileceğin açık topluluk yok. İlkini sen kur.') : null}>
            <View style={{ paddingHorizontal: space.lg }}>
              {veri.gruplar.slice(0, sinir(4)).map((g) => (
                <View key={g.id} style={styles.community}>
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => router.push({ pathname: '/grup/[id]', params: { id: g.id } })}
                    style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Avatar initials={basHarfler(g.name)} tone={grupRengi(g.id)} size={48} square />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
                        {g.name}
                      </Txt>
                      <Txt variant="small" numberOfLines={1}>
                        {grupEtiketi(g)} · {uyeSayisi(g.member_count)}
                      </Txt>
                    </View>
                  </Pressable>
                  <Button
                    label={g.requested ? 'İstek gönderildi' : g.requires_approval ? 'İstek gönder' : 'Katıl'}
                    variant={g.requested || g.requires_approval ? 'outline' : 'primary'}
                    disabled={bekleyen === g.id}
                    onPress={() => void katil(g)}
                    style={styles.smallBtn}
                  />
                </View>
              ))}
            </View>
          </Bolum>
        ) : null}

        {veri && (sekme === 'kisiler' || (sekme === 'tumu' && araniyor)) ? (
          <Bolum
            baslik="Kişiler"
            tumu={sekme === 'tumu' && veri.kisiler.length > 3 ? () => setSekme('kisiler') : undefined}
            bos={!araniyor ? 'Kişi bulmak için adını yaz.' : veri.kisiler.length === 0 ? 'Bu adla kimse yok. Giriş yapmamış hesaplar aramada görünmez.' : null}>
            <View style={{ paddingHorizontal: space.lg }}>
              {veri.kisiler.slice(0, sinir(3)).map((k) => (
                <KisiSatiri key={k.id} k={k} />
              ))}
            </View>
          </Bolum>
        ) : null}

        <View style={{ paddingHorizontal: space.lg, marginTop: space.lg }}>
          <Button label="Rota oluştur" icon="route" variant="dark" href="/rota/olustur" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Bolum({ baslik, tumu, bos, children }: { baslik: string; tumu?: () => void; bos: string | null; children: ReactNode }) {
  return (
    <View style={{ marginBottom: space.lg }}>
      <View style={{ paddingHorizontal: space.lg }}>
        <SectionHeader title={baslik} action={tumu ? 'Tümü' : undefined} onAction={tumu} />
      </View>
      {bos ? (
        <Txt variant="muted" style={{ paddingHorizontal: space.lg, paddingVertical: space.xs }}>
          {bos}
        </Txt>
      ) : (
        children
      )}
    </View>
  );
}

function EtkinlikKarti({ e, koyu, genis }: { e: KesfetEtkinligi; koyu?: boolean; genis?: boolean }) {
  const r = tarihRozeti(e.starts_at);
  const fg = koyu ? colors.night.text : colors.ink;
  const muted = koyu ? '#B9C2BA' : colors.inkMuted;
  const yer = [e.meeting_point_name, uzaklikMetni(e.uzaklik_m) ? `${uzaklikMetni(e.uzaklik_m)} uzakta` : null].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push({ pathname: '/etkinlik/[id]', params: { id: e.id } })}
      style={[styles.eventCard, genis && { width: '100%' }, koyu ? styles.eventDark : styles.eventLight]}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <DateBadge month={r.ay} day={r.gun} tone={koyu ? 'night' : 'sea'} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 15, color: fg }} numberOfLines={2}>
            {e.title}
          </Txt>
          <Txt style={{ fontSize: 12, color: muted }} numberOfLines={1}>
            {kisaTarih(e.starts_at)} · {ACTIVITY_LABELS[e.activity]}
          </Txt>
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 12 }}>
        <Txt style={{ flex: 1, fontSize: 12, color: muted }} numberOfLines={1}>
          {yer || e.group_name || 'Herkese açık'}
        </Txt>
        <Txt style={{ fontSize: 12, fontFamily: fontFamily.bodySemiBold, color: fg }}>
          {e.going_count}
          {e.capacity ? ` / ${e.capacity}` : ''} kişi
        </Txt>
      </View>
    </Pressable>
  );
}

function RotaSatiri({ r }: { r: KesfetRotasi }) {
  const iz = onizleme(r.preview);
  const uzak = uzaklikMetni(r.uzaklik_m);
  return (
    <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/rota/[id]', params: { id: r.id } })} style={styles.row}>
      {iz.length > 1 ? <RouteThumb route={iz} /> : <View style={{ width: 64, height: 64 }} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
          {r.name}
        </Txt>
        <Txt variant="small" numberOfLines={1}>
          {ACTIVITY_LABELS[r.activity]}
          {r.difficulty ? ` · ${DIFFICULTY_LABELS[r.difficulty]}` : ''}
          {r.is_loop ? ' · Döngü' : ''} · {r.owner_name}
        </Txt>
        <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 13, marginTop: 4 }}>
          {formatKm(r.distance_m)} km · ↑ {formatMeters(Math.round(r.elevation_gain_m ?? 0))} m{uzak ? ` · ${uzak} uzakta` : ''}
        </Txt>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.lg, paddingTop: space.sm, marginBottom: space.md },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, borderColor: colors.ink },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, marginHorizontal: space.lg, paddingHorizontal: space.lg, borderRadius: 23, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  searchInput: { flex: 1, fontFamily: fontFamily.body, fontSize: 14, color: colors.ink },
  tabs: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: 14 },
  konum: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: space.lg, marginBottom: space.md, padding: 12, borderRadius: 14, backgroundColor: colors.seaSoft },
  eventCard: { width: 260, padding: 14, borderRadius: 18 },
  eventDark: { backgroundColor: colors.ink },
  eventLight: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  community: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.lineStrong },
  smallBtn: { height: 38, paddingHorizontal: 14 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
});
