import { ACTIVITY_LABELS, ACTIVITY_TYPES, formatKm, type ActivityType } from '@lykiva/shared';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { Button, Chip, Label } from '@/components/ui';
import { rotalarim } from '@/data/rota';
import { etkinlikOlustur, gunKisa, saatMetni, ZORLUK_ADI, type Zorluk } from '@/etkinlik/etkinlikler';
import { gruplarim, grupRotalari, type GrupOzeti } from '@/grup/gruplar';
import { supabaseHazir } from '@/lib/supabase';
import { colors, fontFamily, radius, space } from '@/theme';

type RotaSecenegi = { id: string; ad: string; mesafeM: number; tirmanisM: number | null; bas: [number, number] | null; kimin: string };

const GUN_SAYISI = 45;

function yarinSabah() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return d;
}

export default function EtkinlikOlusturScreen() {
  const { grup: grupParam } = useLocalSearchParams<{ grup?: string }>();
  const insets = useSafeAreaInsets();
  const [ad, setAd] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [aktivite, setAktivite] = useState<ActivityType>('bike');
  const [zaman, setZaman] = useState(yarinSabah);
  const [gruplar, setGruplar] = useState<GrupOzeti[] | null>(null);
  const [grup, setGrup] = useState<string | null>(grupParam ?? null);
  const [herkeseAcik, setHerkeseAcik] = useState(false);
  const [rotalar, setRotalar] = useState<RotaSecenegi[]>([]);
  const [rota, setRota] = useState<string | null>(null);
  const [yerAdi, setYerAdi] = useState('');
  const [nokta, setNokta] = useState<[number, number] | null>(null);
  const [konumAliniyor, setKonumAliniyor] = useState(false);
  const [zorluk, setZorluk] = useState<Zorluk | null>(null);
  const [kontenjan, setKontenjan] = useState<number | null>(null);
  const [kaydediyor, setKaydediyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseHazir) return;
    gruplarim()
      .then((g) => {
        setGruplar(g);
        // Gruptan açılmadıysa ve tek grup varsa onu seç
        if (!grupParam && g.length === 1) setGrup(g[0].id);
      })
      .catch(() => setGruplar([]));
  }, [grupParam]);

  // Rota seçenekleri: kendi rotalarım + seçili gruba paylaşılanlar
  useEffect(() => {
    if (!supabaseHazir) return;
    let acik = true;
    (async () => {
      const [benim, gruptaki] = await Promise.all([rotalarim().catch(() => []), grup ? grupRotalari(grup).catch(() => []) : Promise.resolve([])]);
      if (!acik) return;
      const liste: RotaSecenegi[] = benim.map((r) => ({
        id: r.id,
        ad: r.name,
        mesafeM: r.distanceM,
        tirmanisM: r.gainM,
        bas: r.points[0] ? [r.points[0].lng, r.points[0].lat] : null,
        kimin: 'Senin',
      }));
      for (const r of gruptaki) {
        if (liste.some((x) => x.id === r.id)) continue;
        liste.push({ id: r.id, ad: r.name, mesafeM: r.distance_m, tirmanisM: r.elevation_gain_m, bas: r.preview?.[0] ? [r.preview[0][0], r.preview[0][1]] : null, kimin: r.owner_name });
      }
      setRotalar(liste);
    })();
    return () => {
      acik = false;
    };
  }, [grup]);

  const gunler = useMemo(() => {
    const bugun = new Date();
    bugun.setHours(0, 0, 0, 0);
    return Array.from({ length: GUN_SAYISI }, (_, i) => new Date(bugun.getTime() + i * 86_400_000));
  }, []);
  const ayniGun = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  function gunSec(g: Date) {
    const d = new Date(g);
    d.setHours(zaman.getHours(), zaman.getMinutes(), 0, 0);
    setZaman(d);
  }
  function saatEkle(dk: number) {
    const d = new Date(zaman.getTime() + dk * 60_000);
    // Gün değişmesin: yalnızca saat/dakika kayar
    if (!ayniGun(d, zaman)) d.setTime(zaman.getTime() + (dk > 0 ? -(24 * 60 - dk) : 24 * 60 + dk) * 60_000);
    setZaman(d);
  }

  async function konumumuKullan() {
    setKonumAliniyor(true);
    try {
      const izin = await Location.requestForegroundPermissionsAsync();
      if (!izin.granted) throw new Error('Konum izni verilmedi');
      const k = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setNokta([k.coords.longitude, k.coords.latitude]);
      if (!yerAdi.trim()) setYerAdi('Buluşma noktası');
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Konum alınamadı');
    } finally {
      setKonumAliniyor(false);
    }
  }

  const seciliRota = rotalar.find((r) => r.id === rota) ?? null;

  async function yayinla() {
    setHata(null);
    if (ad.trim().length < 2) return setHata('Etkinliğe bir ad ver.');
    if (zaman.getTime() < Date.now() + 5 * 60_000) return setHata('Etkinlik zamanı en az birkaç dakika sonra olmalı.');
    setKaydediyor(true);
    try {
      const id = await etkinlikOlustur({
        title: ad.trim(),
        description: aciklama.trim(),
        activity: aktivite,
        starts_at: zaman.toISOString(),
        group_id: grup,
        visibility: grup && !herkeseAcik ? 'groups' : 'public',
        route_id: rota,
        meeting_lng: nokta?.[0] ?? null,
        meeting_lat: nokta?.[1] ?? null,
        meeting_point_name: yerAdi.trim(),
        difficulty: zorluk,
        capacity: kontenjan,
      });
      router.replace({ pathname: '/etkinlik/[id]', params: { id } });
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Etkinlik oluşturulamadı');
    } finally {
      setKaydediyor(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="Yeni etkinlik" backIcon="close" center />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 4, gap: 16, paddingBottom: insets.bottom + 110 }} keyboardShouldPersistTaps="handled">
        <View>
          <Txt variant="small">Etkinlik adı</Txt>
          <TextInput value={ad} onChangeText={setAd} placeholder="ör. Gün doğumu sürüşü" placeholderTextColor={colors.inkMuted} maxLength={80} accessibilityLabel="Etkinlik adı" style={styles.name} />
        </View>

        <View>
          <Label>Aktivite</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} accessibilityRole="radiogroup">
            {ACTIVITY_TYPES.map((t) => (
              <Chip key={t} label={ACTIVITY_LABELS[t]} role="radio" selected={t === aktivite} onPress={() => setAktivite(t)} />
            ))}
          </ScrollView>
        </View>

        <View>
          <Label>Tarih</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} accessibilityRole="radiogroup">
            {gunler.map((g) => {
              const on = ayniGun(g, zaman);
              return (
                <Pressable
                  key={g.toISOString()}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={g.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  onPress={() => gunSec(g)}
                  style={[styles.gun, on && styles.gunOn]}>
                  <Txt style={{ fontSize: 11, color: on ? colors.ground : colors.inkMuted, fontFamily: fontFamily.bodySemiBold }}>{gunKisa(g)}</Txt>
                  <Txt style={{ fontFamily: fontFamily.display, fontSize: 20, color: on ? colors.ground : colors.ink }}>{g.getDate()}</Txt>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ gap: 8 }}>
          <View>
            <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14 }}>Başlangıç saati</Txt>
            <Txt variant="small">{zaman.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</Txt>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} accessibilityRole="adjustable" accessibilityLabel="Başlangıç saati" accessibilityValue={{ text: saatMetni(zaman) }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Bir saat geri" onPress={() => saatEkle(-60)} style={styles.step}>
              <Txt style={styles.stepTxt}>−1s</Txt>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="15 dakika geri" onPress={() => saatEkle(-15)} style={styles.step}>
              <Txt style={styles.stepTxt}>−</Txt>
            </Pressable>
            <Txt numberOfLines={1} style={{ flex: 1, textAlign: 'center', fontFamily: fontFamily.display, fontSize: 28 }}>
              {saatMetni(zaman)}
            </Txt>
            <Pressable accessibilityRole="button" accessibilityLabel="15 dakika ileri" onPress={() => saatEkle(15)} style={styles.step}>
              <Txt style={styles.stepTxt}>+</Txt>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Bir saat ileri" onPress={() => saatEkle(60)} style={styles.step}>
              <Txt style={styles.stepTxt}>+1s</Txt>
            </Pressable>
          </View>
        </View>

        <View>
          <Label>Kimlerle</Label>
          {gruplar === null && supabaseHazir ? <ActivityIndicator color={colors.terra} /> : null}
          <View style={{ gap: 6 }} accessibilityRole="radiogroup">
            {(gruplar ?? []).map((g) => (
              <Pressable key={g.id} accessibilityRole="radio" accessibilityState={{ checked: grup === g.id }} onPress={() => setGrup(g.id)} style={[styles.secim, grup === g.id && styles.secimOn]}>
                <View style={[styles.radio, grup === g.id && styles.radioOn]} />
                <Txt style={{ flex: 1, fontFamily: fontFamily.bodySemiBold, fontSize: 14 }} numberOfLines={1}>
                  {g.name}
                </Txt>
                <Txt variant="small">{g.member_count} üye</Txt>
              </Pressable>
            ))}
            <Pressable accessibilityRole="radio" accessibilityState={{ checked: grup === null }} onPress={() => setGrup(null)} style={[styles.secim, grup === null && styles.secimOn]}>
              <View style={[styles.radio, grup === null && styles.radioOn]} />
              <Txt style={{ flex: 1, fontFamily: fontFamily.bodySemiBold, fontSize: 14 }}>Grupsuz, herkese açık</Txt>
              <Txt variant="small">bağlantıyla</Txt>
            </Pressable>
          </View>
          {grup ? (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }} accessibilityRole="radiogroup">
              <Chip label="Yalnızca grup üyeleri" role="radio" tone="sea" selected={!herkeseAcik} onPress={() => setHerkeseAcik(false)} />
              <Chip label="Herkese açık" role="radio" tone="sea" selected={herkeseAcik} onPress={() => setHerkeseAcik(true)} />
            </View>
          ) : null}
        </View>

        <View>
          <Label>Buluşma noktası</Label>
          <TextInput value={yerAdi} onChangeText={setYerAdi} placeholder="ör. Kaş Cumhuriyet Meydanı" placeholderTextColor={colors.inkMuted} maxLength={120} accessibilityLabel="Buluşma noktasının adı" style={styles.input} />
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <Chip label={konumAliniyor ? 'Konum alınıyor…' : 'Konumumu kullan'} icon="pin" onPress={() => void konumumuKullan()} selected={false} />
            {seciliRota?.bas ? <Chip label="Rotanın başlangıcı" icon="route" onPress={() => setNokta(seciliRota.bas)} selected={false} /> : null}
            {nokta ? <Chip label="Haritadaki noktayı kaldır" icon="close" onPress={() => setNokta(null)} selected={false} /> : null}
          </View>
          <Txt variant="small" style={{ marginTop: 4 }}>
            {nokta ? `Haritada işaretli: ${nokta[1].toFixed(5)}, ${nokta[0].toFixed(5)}` : 'İstersen haritada da göster: konumunu ya da rotanın başlangıcını kullan.'}
          </Txt>
        </View>

        <View>
          <Label>Rota (isteğe bağlı)</Label>
          <View style={{ gap: 6 }} accessibilityRole="radiogroup">
            <Pressable accessibilityRole="radio" accessibilityState={{ checked: rota === null }} onPress={() => setRota(null)} style={[styles.secim, rota === null && styles.secimOn]}>
              <View style={[styles.radio, rota === null && styles.radioOn]} />
              <Txt style={{ flex: 1, fontFamily: fontFamily.bodySemiBold, fontSize: 14 }}>Rota yok</Txt>
            </Pressable>
            {rotalar.map((r) => (
              <Pressable key={r.id} accessibilityRole="radio" accessibilityState={{ checked: rota === r.id }} onPress={() => setRota(r.id)} style={[styles.secim, rota === r.id && styles.secimOn]}>
                <View style={[styles.radio, rota === r.id && styles.radioOn]} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14 }} numberOfLines={1}>
                    {r.ad}
                  </Txt>
                  <Txt variant="small">
                    {formatKm(r.mesafeM)} km{r.tirmanisM != null ? ` · ↑ ${Math.round(r.tirmanisM)} m` : ''} · {r.kimin}
                  </Txt>
                </View>
              </Pressable>
            ))}
          </View>
          {grup && seciliRota?.kimin === 'Senin' ? <Txt variant="small" style={{ marginTop: 4 }}>Rotan gizli olsa bile grup üyeleri görebilsin diye gruba paylaşılır.</Txt> : null}
        </View>

        <View>
          <Label>Seviye (isteğe bağlı)</Label>
          <View accessibilityRole="radiogroup" style={styles.seg}>
            {(Object.keys(ZORLUK_ADI) as Zorluk[]).map((z) => (
              <Pressable key={z} accessibilityRole="radio" accessibilityState={{ checked: z === zorluk }} onPress={() => setZorluk(z === zorluk ? null : z)} style={[styles.segBtn, z === zorluk && { backgroundColor: colors.ink }]}>
                <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: z === zorluk ? colors.ground : colors.ink }}>{ZORLUK_ADI[z]}</Txt>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.saatSatiri}>
          <View style={{ flex: 1 }}>
            <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14 }}>Kontenjan</Txt>
            <Txt variant="small">{kontenjan ? 'Dolunca bekleme listesi açılır' : 'Sınırsız'}</Txt>
          </View>
          {kontenjan ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessibilityRole="adjustable" accessibilityLabel="Kontenjan" accessibilityValue={{ now: kontenjan, min: 2, max: 999 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Azalt" onPress={() => setKontenjan(kontenjan <= 2 ? null : kontenjan - 1)} style={styles.step}>
                <Txt style={styles.stepTxt}>−</Txt>
              </Pressable>
              <Txt style={{ width: 44, textAlign: 'center', fontFamily: fontFamily.display, fontSize: 22 }}>{kontenjan}</Txt>
              <Pressable accessibilityRole="button" accessibilityLabel="Artır" onPress={() => setKontenjan(Math.min(999, kontenjan + 1))} style={styles.step}>
                <Txt style={styles.stepTxt}>+</Txt>
              </Pressable>
            </View>
          ) : (
            <Chip label="Sınır koy" icon="plus" onPress={() => setKontenjan(10)} selected={false} />
          )}
        </View>

        <View>
          <Label>Açıklama (isteğe bağlı)</Label>
          <TextInput
            value={aciklama}
            onChangeText={setAciklama}
            placeholder="Tempo, mola, getirilecekler…"
            placeholderTextColor={colors.inkMuted}
            maxLength={1000}
            multiline
            accessibilityLabel="Açıklama"
            style={[styles.input, { height: 88, paddingTop: 12, textAlignVertical: 'top' }]}
          />
        </View>

        {!supabaseHazir ? <Txt variant="muted">Sunucu anahtarı girilmemiş; etkinlik oluşturulamaz.</Txt> : null}
        {hata ? (
          <View style={styles.hata} accessibilityRole="alert">
            <Icon name="shield" size={18} color={colors.terraInk} />
            <Txt style={{ flex: 1, color: colors.terraInk }}>{hata}</Txt>
          </View>
        ) : null}
      </ScrollView>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Button label={kaydediyor ? 'Yayınlanıyor…' : 'Etkinliği yayınla'} icon="calendar" onPress={() => void yayinla()} disabled={kaydediyor || !supabaseHazir} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  name: { fontFamily: fontFamily.display, fontSize: 24, color: colors.ink, borderBottomWidth: 1.5, borderBottomColor: colors.lineStrong, paddingVertical: 6 },
  input: { height: 48, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, fontFamily: fontFamily.body, fontSize: 15, color: colors.ink },
  gun: { width: 52, height: 64, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  gunOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  saatSatiri: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  step: { minWidth: 40, height: 40, paddingHorizontal: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { fontSize: 15, fontFamily: fontFamily.bodySemiBold },
  secim: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8 },
  secimOn: { borderColor: colors.sea, borderWidth: 1.5 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#9C9282' },
  radioOn: { borderWidth: 6, borderColor: colors.sea },
  seg: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: 14, backgroundColor: colors.land },
  segBtn: { flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  hata: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12, borderRadius: radius.md, backgroundColor: colors.terraSoft },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: 12, backgroundColor: colors.ground },
});
