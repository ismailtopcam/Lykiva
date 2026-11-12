/**
 * Profili paylaş / arkadaş bul (Profil > Profili paylaş).
 * Üstte iki bölüm: Arkadaşlar · Kulüpler; altında "Lykiva'da ara" kutusu.
 * Arkadaşlar'da arama boşken üç sekme: Önerilenler (kisi_ara öneri modu) · Kişiler (takip ettiklerin ve
 * takipçilerin) · QR kodu (web profilinin adresi; telefon kamerasıyla okutulunca profil açılır).
 * Kulüpler'de arama boşken önerilen açık kulüpler ve kendi kulüplerin.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { kisiAra, takipListesi, type KisiOzeti } from '@/akis/akis';
import { Header } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { KisiSatiri } from '@/components/KisiSatiri';
import { Txt } from '@/components/Txt';
import { Avatar, Button, SectionHeader } from '@/components/ui';
import { profilim, type Profilim } from '@/data/aktivite';
import { basHarfler, grupEtiketi, grupRengi, gruplarim, kesfetGruplar, uyeSayisi, type GrupOzeti, type KesfetGrubu } from '@/grup/gruplar';
import { baglantiPaylas, profilAdresi } from '@/lib/baglanti';
import { useHesap } from '@/lib/giris';
import { oturumuSagla } from '@/lib/supabase';
import { colors, fontFamily, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

type Bolum = 'arkadaslar' | 'kulupler';
type AltSekme = 'oneri' | 'kisiler' | 'qr';

const hataMetni = (e: unknown) => (e instanceof Error ? e.message : $t('ortak.yuklenemedi'));

/** Yazmayı bitirince arar (kısa bekleme); 2 harften kısa aramada null döner */
function useArama<T>(arama: string, ara: (q: string) => Promise<T[]>) {
  const [sonuc, setSonuc] = useState<T[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const istekNo = useRef(0);
  const q = arama.trim();
  const aktif = q.length >= 2;

  useEffect(() => {
    const no = ++istekNo.current;
    if (!aktif) return;
    const t = setTimeout(() => {
      setSonuc(null);
      setHata(null);
      ara(q)
        .then((l) => no === istekNo.current && setSonuc(l))
        .catch((e) => {
          if (no !== istekNo.current) return;
          setHata(hataMetni(e));
          setSonuc([]);
        });
    }, 300);
    return () => clearTimeout(t);
  }, [q, aktif, ara]);

  return { aktif, sonuc: aktif ? sonuc : null, hata: aktif ? hata : null };
}

export default function ProfilPaylasScreen() {
  const [bolum, setBolum] = useState<Bolum>('arkadaslar');
  const [sekme, setSekme] = useState<AltSekme>('oneri');
  const [arama, setArama] = useState('');
  const kisiArama = useArama(bolum === 'arkadaslar' ? arama : '', kisiAra);
  const kulupArama = useArama(bolum === 'kulupler' ? arama : '', kesfetGruplar);
  const araniyor = arama.trim().length >= 2;

  const bolumler: { id: Bolum; ad: string }[] = [
    { id: 'arkadaslar', ad: $t('profilPaylas.arkadaslar') },
    { id: 'kulupler', ad: $t('profilPaylas.kulupler') },
  ];
  const sekmeler: { id: AltSekme; ad: string }[] = [
    { id: 'oneri', ad: $t('profilPaylas.onerilenler') },
    { id: 'kisiler', ad: $t('profilPaylas.kisiler') },
    { id: 'qr', ad: $t('profilPaylas.qr_kodu') },
  ];

  return (
    <View style={styles.root}>
      <Header title={$t('profil.profili_paylas')} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View accessibilityRole="tablist" style={styles.bolumler}>
          {bolumler.map((b) => (
            <Pressable
              key={b.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: b.id === bolum }}
              onPress={() => setBolum(b.id)}
              style={[styles.bolum, b.id === bolum && styles.bolumOn]}>
              <Txt numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fontFamily.bodyBold, fontSize: 14, color: b.id === bolum ? colors.ground : colors.ink }}>
                {b.ad}
              </Txt>
            </Pressable>
          ))}
        </View>

        <View style={styles.search}>
          <Icon name="search" size={18} color={colors.inkMuted} />
          <TextInput
            value={arama}
            onChangeText={setArama}
            placeholder={$t('profilPaylas.lykiva_da_ara')}
            placeholderTextColor={colors.inkMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={bolum === 'arkadaslar' ? $t('ortak.kisi_ara') : $t('profilPaylas.kulup_ara')}
            style={styles.input}
          />
          {arama ? (
            <Pressable accessibilityRole="button" accessibilityLabel={$t('profilPaylas.aramayi_temizle')} onPress={() => setArama('')} hitSlop={10}>
              <Icon name="close" size={18} color={colors.inkMuted} />
            </Pressable>
          ) : null}
        </View>

        {bolum === 'arkadaslar' ? (
          araniyor ? (
            <KisiSonuclari baslik={$t('kisiler.sonuclar')} liste={kisiArama.sonuc} hata={kisiArama.hata} bos={$t('kisiler.bu_adla_kimse_bulunamadi')} />
          ) : (
            <>
              <View accessibilityRole="tablist" style={styles.sekmeler}>
                {sekmeler.map((s) => (
                  <Pressable
                    key={s.id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: s.id === sekme }}
                    onPress={() => setSekme(s.id)}
                    style={[styles.sekme, s.id === sekme && styles.sekmeOn]}>
                    <Txt
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={{ fontFamily: s.id === sekme ? fontFamily.bodyBold : fontFamily.bodySemiBold, fontSize: 14, color: s.id === sekme ? colors.ink : colors.inkMuted }}>
                      {s.ad}
                    </Txt>
                  </Pressable>
                ))}
              </View>
              {sekme === 'oneri' ? <Oneriler /> : sekme === 'kisiler' ? <Kisilerim /> : <QrKodu />}
            </>
          )
        ) : araniyor ? (
          <KulupSonuclari liste={kulupArama.sonuc} hata={kulupArama.hata} />
        ) : (
          <KulupOnerileri />
        )}
      </ScrollView>
    </View>
  );
}

function Hata({ metin }: { metin: string | null }) {
  if (!metin) return null;
  return (
    <Txt accessibilityRole="alert" style={{ color: colors.terraInk, marginVertical: space.md }}>
      {metin}
    </Txt>
  );
}

function KisiSonuclari({ baslik, liste, hata, bos }: { baslik: string; liste: KisiOzeti[] | null; hata: string | null; bos: string }) {
  return (
    <View>
      <SectionHeader title={baslik} />
      <Hata metin={hata} />
      {liste === null ? <ActivityIndicator color={colors.terra} style={{ marginVertical: space.lg }} /> : null}
      {liste && liste.length === 0 && !hata ? (
        <Txt variant="muted" style={{ paddingVertical: space.md }}>
          {bos}
        </Txt>
      ) : null}
      {liste?.map((k) => (
        <KisiSatiri key={k.id} k={k} />
      ))}
    </View>
  );
}

/** Seni takip edenler ve grup arkadaşların (kisi_ara aramasız) */
function Oneriler() {
  const [liste, setListe] = useState<KisiOzeti[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let acik = true;
      kisiAra()
        .then((l) => acik && setListe(l))
        .catch((e) => {
          if (!acik) return;
          setHata(hataMetni(e));
          setListe([]);
        });
      return () => {
        acik = false;
      };
    }, []),
  );

  return <KisiSonuclari baslik={$t('kisiler.taniyor_olabileceklerin')} liste={liste} hata={hata} bos={$t('kisiler.simdilik_onerimiz_yok_bir')} />;
}

/** Takip ettiklerin ve takipçilerin */
function Kisilerim() {
  const [takip, setTakip] = useState<KisiOzeti[] | null>(null);
  const [takipci, setTakipci] = useState<KisiOzeti[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let acik = true;
      (async () => {
        try {
          const uid = await oturumuSagla();
          const [a, b] = await Promise.all([takipListesi(uid, 'takip'), takipListesi(uid, 'takipci')]);
          if (!acik) return;
          setTakip(a);
          setTakipci(b);
        } catch (e) {
          if (!acik) return;
          setHata(hataMetni(e));
          setTakip([]);
          setTakipci([]);
        }
      })();
      return () => {
        acik = false;
      };
    }, []),
  );

  if (takip === null || takipci === null) return <ActivityIndicator color={colors.terra} style={{ marginVertical: space.lg }} />;
  if (hata) return <Hata metin={hata} />;
  if (takip.length === 0 && takipci.length === 0) {
    return (
      <Txt variant="muted" style={{ paddingVertical: space.md }}>
        {$t('profilPaylas.kimse_yok')}
      </Txt>
    );
  }
  return (
    <View style={{ gap: space.lg }}>
      {takip.length ? (
        <View>
          <SectionHeader title={`${$t('profilPaylas.takip_ettiklerin')} · ${takip.length}`} />
          {takip.map((k) => (
            <KisiSatiri key={k.id} k={k} />
          ))}
        </View>
      ) : null}
      {takipci.length ? (
        <View>
          <SectionHeader title={`${$t('profilPaylas.takipcilerin')} · ${takipci.length}`} />
          {takipci.map((k) => (
            <KisiSatiri key={k.id} k={k} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Web profilinin adresi QR kod olarak. Geçici hesabın web profili yok. */
function QrKodu() {
  const hesap = useHesap();
  const [profil, setProfil] = useState<Profilim | null | undefined>(undefined);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    let acik = true;
    oturumuSagla()
      .then((uid) => profilim(uid))
      .then((p) => acik && setProfil(p))
      .catch((e) => {
        if (!acik) return;
        setHata(hataMetni(e));
        setProfil(null);
      });
    return () => {
      acik = false;
    };
  }, []);

  if (hesap?.gecici) {
    return (
      <View style={styles.qrKutu}>
        <Txt variant="muted" style={{ textAlign: 'center', marginBottom: space.md }}>
          {$t('profilPaylas.qr_gecici')}
        </Txt>
        <Button label={$t('profil.giris_yap_ya_da')} href="/giris" style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }
  if (profil === undefined) return <ActivityIndicator color={colors.terra} style={{ marginVertical: space.lg }} />;
  if (!profil) return <Hata metin={hata ?? $t('ortak.yuklenemedi')} />;

  const adres = profilAdresi(profil.username);
  return (
    <View style={styles.qrKutu}>
      <Avatar initials={basHarfler(profil.displayName)} tone="ink" size={56} uri={profil.avatarUrl} />
      <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 17, marginTop: space.sm }} numberOfLines={1}>
        {profil.displayName}
      </Txt>
      <Txt variant="muted" style={{ fontSize: 13, marginBottom: space.md }} numberOfLines={1}>
        @{profil.username}
      </Txt>
      {/* Koyu temada da okunsun diye kod her zaman beyaz zemin üstünde koyu */}
      <View style={styles.qr} accessible accessibilityRole="image" accessibilityLabel={$t('profilPaylas.qr_etiket', { username: profil.username })}>
        <QRCode value={adres} size={208} color="#16201B" backgroundColor="#FFFFFF" ecl="M" />
      </View>
      <Txt variant="small" style={{ textAlign: 'center', marginTop: space.md, marginBottom: space.lg }}>
        {$t('profilPaylas.qr_aciklama')}
      </Txt>
      <Button
        label={$t('profilPaylas.baglantiyi_paylas')}
        icon="share"
        onPress={() => void baglantiPaylas($t('profil.lykiva_da', { displayName: profil.displayName }), adres)}
        style={{ alignSelf: 'stretch' }}
      />
    </View>
  );
}

function KulupSatiri({ g, alt }: { g: { id: string; name: string; avatar_url: string | null }; alt: string }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/grup/[id]', params: { id: g.id } })} style={styles.row}>
      <Avatar initials={basHarfler(g.name)} tone={grupRengi(g.id)} size={44} square uri={g.avatar_url} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
          {g.name}
        </Txt>
        <Txt variant="small" numberOfLines={1}>
          {alt}
        </Txt>
      </View>
      <Icon name="chevron" size={18} color={colors.inkMuted} />
    </Pressable>
  );
}

const kesfetAlt = (g: KesfetGrubu) => `${grupEtiketi(g)} · ${uyeSayisi(g.member_count)}${g.requires_approval ? $t('gruplar.onayli_katilim') : ''}`;

function KulupSonuclari({ liste, hata }: { liste: KesfetGrubu[] | null; hata: string | null }) {
  return (
    <View>
      <SectionHeader title={$t('kisiler.sonuclar')} />
      <Hata metin={hata} />
      {liste === null ? <ActivityIndicator color={colors.terra} style={{ marginVertical: space.lg }} /> : null}
      {liste && liste.length === 0 && !hata ? (
        <Txt variant="muted" style={{ paddingVertical: space.md }}>
          {$t('gruplar.aramana_uyan_acik_topluluk')}
        </Txt>
      ) : null}
      {liste?.map((g) => (
        <KulupSatiri key={g.id} g={g} alt={kesfetAlt(g)} />
      ))}
    </View>
  );
}

/** Katılabileceğin açık kulüpler ve üyesi olduğun kulüpler */
function KulupOnerileri() {
  const [oneri, setOneri] = useState<KesfetGrubu[] | null>(null);
  const [benim, setBenim] = useState<GrupOzeti[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let acik = true;
      Promise.all([kesfetGruplar(), gruplarim()])
        .then(([o, b]) => {
          if (!acik) return;
          setOneri(o);
          setBenim(b);
        })
        .catch((e) => {
          if (!acik) return;
          setHata(hataMetni(e));
          setOneri([]);
          setBenim([]);
        });
      return () => {
        acik = false;
      };
    }, []),
  );

  if (oneri === null || benim === null) return <ActivityIndicator color={colors.terra} style={{ marginVertical: space.lg }} />;
  return (
    <View style={{ gap: space.lg }}>
      <Hata metin={hata} />
      <View>
        <SectionHeader title={$t('profilPaylas.onerilen_kulupler')} />
        {oneri.length === 0 && !hata ? (
          <Txt variant="muted" style={{ paddingVertical: space.md }}>
            {$t('gruplar.simdilik_katilabilecegin_acik_topluluk')}
          </Txt>
        ) : null}
        {oneri.map((g) => (
          <KulupSatiri key={g.id} g={g} alt={kesfetAlt(g)} />
        ))}
      </View>
      {benim.length ? (
        <View>
          <SectionHeader title={$t('profilPaylas.kuluplerin')} />
          {benim.map((g) => (
            <KulupSatiri key={g.id} g={g} alt={`${grupEtiketi(g)} · ${uyeSayisi(g.member_count)}`} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = temaliStil(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  bolumler: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, marginBottom: space.md },
  bolum: { flex: 1, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  bolumOn: { backgroundColor: colors.ink },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: space.md,
  },
  input: { flex: 1, fontFamily: fontFamily.body, fontSize: 15, color: colors.ink },
  sekmeler: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.lineStrong, marginBottom: space.md },
  sekme: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2.5, borderBottomColor: 'transparent', paddingHorizontal: 4 },
  sekmeOn: { borderBottomColor: colors.ink },
  qrKutu: { alignItems: 'center', padding: space.lg, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  qr: { padding: 14, borderRadius: 16, backgroundColor: '#FFFFFF' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.lineStrong },
}));
