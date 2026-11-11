/**
 * Giriş ekranındaki e-posta formu: giriş yap / hesap aç / şifremi unuttum ve e-postadaki kodu doğrulama.
 * Mantık: `lib/epostaGiris.ts`.
 */
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Txt } from '@/components/Txt';
import { Button, Label } from '@/components/ui';
import {
  EpostaDogrulanmadi,
  EpostaKayitli,
  epostaGecerli,
  epostaHataMetni,
  epostaIleGiris,
  epostaIleKayit,
  epostaSadelestir,
  kodDogrula,
  kodSadelestir,
  koduTekrarGonder,
  type KodTuru,
  SIFRE_EN_AZ,
  sifreSifirlamaKoduGonder,
  sifreyiYenile,
} from '@/lib/epostaGiris';
import type { GirisSonucu } from '@/lib/giris';
import { colors, fontFamily, radius, space } from '@/theme';
import { $t } from '@/i18n';

type Gorunum = 'giris' | 'kayit' | 'unuttum' | 'kod';

/** Kodu tekrar istemeden önce beklenen süre (sn) */
const TEKRAR_BEKLEME = 60;

export function EpostaGiris({ onBitti, onVazgec }: { onBitti: (sonuc: GirisSonucu) => void; onVazgec: () => void }) {
  const [gorunum, setGorunum] = useState<Gorunum>('giris');
  const [oncekiGorunum, setOncekiGorunum] = useState<Gorunum>('giris');
  const [kodTuru, setKodTuru] = useState<KodTuru>('kayit');

  const [eposta, setEposta] = useState('');
  const [sifre, setSifre] = useState('');
  const [ad, setAd] = useState('');
  const [kod, setKod] = useState('');
  const [sifreGorunsun, setSifreGorunsun] = useState(false);

  const [bekliyor, setBekliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [bekleme, setBekleme] = useState(0);

  const sifreKutusu = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (bekleme <= 0) return;
    const t = setTimeout(() => setBekleme((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [bekleme]);

  function gec(yeni: Gorunum) {
    setHata(null);
    setBilgi(null);
    setGorunum(yeni);
  }

  function kodaGec(tur: KodTuru, mesaj: string) {
    setOncekiGorunum(gorunum);
    setKodTuru(tur);
    setKod('');
    if (tur === 'sifre') setSifre('');
    setBekleme(TEKRAR_BEKLEME);
    setHata(null);
    setBilgi(mesaj);
    setGorunum('kod');
  }

  async function calistir(is: () => Promise<void>) {
    if (bekliyor) return;
    setHata(null);
    setBekliyor(true);
    try {
      await is();
    } catch (e) {
      setHata(epostaHataMetni(e));
    } finally {
      setBekliyor(false);
    }
  }

  const adres = epostaSadelestir(eposta);

  function epostaDenetle(): boolean {
    if (!epostaGecerli(eposta)) {
      setHata($t('epostaGiris.gecerli_bir_e_posta'));
      return false;
    }
    return true;
  }

  function sifreDenetle(): boolean {
    if (sifre.length < SIFRE_EN_AZ) {
      setHata($t('epostaGiris.sifre_en_az_karakter', { sIFRE_EN_AZ: SIFRE_EN_AZ }));
      return false;
    }
    return true;
  }

  function girisYap() {
    if (!epostaDenetle()) return;
    if (!sifre) {
      setHata($t('epostaGiris.sifreni_yaz'));
      return;
    }
    void calistir(async () => {
      try {
        onBitti(await epostaIleGiris(adres, sifre));
      } catch (e) {
        if (e instanceof EpostaDogrulanmadi) {
          kodaGec('kayit', $t('epostaGiris.e_postan_henuz_dogrulanmamis', { adres }));
          return;
        }
        throw e;
      }
    });
  }

  function kayitOl() {
    if (!epostaDenetle() || !sifreDenetle()) return;
    void calistir(async () => {
      try {
        const tur = await epostaIleKayit(adres, sifre, ad.trim() || null);
        if (!tur) {
          onBitti({ tasinan: 0 });
          return;
        }
        kodaGec(tur, $t('epostaGiris.adresine_bir_dogrulama_kodu', { adres }));
      } catch (e) {
        if (e instanceof EpostaKayitli) {
          gec('giris');
          setHata(epostaHataMetni(e));
          return;
        }
        throw e;
      }
    });
  }

  function sifirlamaKoduIste() {
    if (!epostaDenetle()) return;
    void calistir(async () => {
      await sifreSifirlamaKoduGonder(adres);
      kodaGec('sifre', $t('epostaGiris.bu_e_postayla_bir', { adres }));
    });
  }

  function koduOnayla() {
    const temiz = kodSadelestir(kod);
    if (temiz.length < 6) {
      setHata($t('epostaGiris.e_postadaki_kodu_yaz'));
      return;
    }
    if (kodTuru === 'sifre' && !sifreDenetle()) return;
    void calistir(async () => {
      const sonuc =
        kodTuru === 'sifre'
          ? await sifreyiYenile(adres, temiz, sifre)
          : await kodDogrula(adres, temiz, kodTuru, { sifre, ad: ad.trim() || null });
      onBitti(sonuc);
    });
  }

  function tekrarGonder() {
    if (bekleme > 0) return;
    void calistir(async () => {
      await koduTekrarGonder(adres, kodTuru);
      setBekleme(TEKRAR_BEKLEME);
      setBilgi($t('epostaGiris.yeni_kod_adresine_gonderildi', { adres }));
    });
  }

  const baslik = { giris: $t('epostaGiris.e_postayla_giris'), kayit: $t('epostaGiris.hesap_ac'), unuttum: $t('epostaGiris.sifreni_sifirla'), kod: 'Kodu gir' }[gorunum];

  return (
    <View style={{ gap: space.md }}>
      <Txt variant="display" accessibilityRole="header" style={{ fontSize: 28, lineHeight: 34 }}>
        {baslik}
      </Txt>

      {gorunum === 'giris' || gorunum === 'kayit' ? (
        <View style={styles.sekmeler} accessibilityRole="tablist">
          {(['giris', 'kayit'] as const).map((g) => (
            <Pressable
              key={g}
              accessibilityRole="tab"
              accessibilityState={{ selected: gorunum === g }}
              onPress={() => gec(g)}
              disabled={bekliyor}
              style={[styles.sekme, gorunum === g && styles.sekmeSecili]}>
              <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: gorunum === g ? colors.ink : colors.inkMuted }}>
                {g === 'giris' ? $t('epostaGiris.giris_yap') : $t('epostaGiris.hesap_ac')}
              </Txt>
            </Pressable>
          ))}
        </View>
      ) : null}

      {bilgi ? (
        <View accessibilityLiveRegion="polite" style={styles.bilgi}>
          <Txt style={{ color: colors.seaInk, fontSize: 13 }}>{bilgi}</Txt>
        </View>
      ) : null}
      {hata ? (
        <View accessibilityLiveRegion="polite" style={styles.hata}>
          <Txt style={{ color: colors.terraInk, fontSize: 13 }}>{hata}</Txt>
        </View>
      ) : null}

      {gorunum !== 'kod' ? (
        <View>
          <Label>{$t('epostaGiris.e_posta')}</Label>
          <TextInput
            value={eposta}
            onChangeText={setEposta}
            placeholder={$t('epostaGiris.ornek_eposta_com')}
            placeholderTextColor={colors.inkMuted}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType={gorunum === 'unuttum' ? 'send' : 'next'}
            onSubmitEditing={() => (gorunum === 'unuttum' ? sifirlamaKoduIste() : sifreKutusu.current?.focus())}
            accessibilityLabel={$t('epostaGiris.e_posta')}
            editable={!bekliyor}
            style={styles.input}
          />
        </View>
      ) : null}

      {gorunum === 'kayit' ? (
        <View>
          <Label>{$t('epostaGiris.adin_istege_bagli')}</Label>
          <TextInput
            value={ad}
            onChangeText={setAd}
            placeholder={$t('epostaGiris.or_ayse_yilmaz')}
            placeholderTextColor={colors.inkMuted}
            autoComplete="name"
            textContentType="name"
            maxLength={40}
            accessibilityLabel={$t('epostaGiris.adin')}
            editable={!bekliyor}
            style={styles.input}
          />
        </View>
      ) : null}

      {gorunum === 'kod' ? (
        <View>
          <Label>{$t('epostaGiris.dogrulama_kodu')}</Label>
          <TextInput
            value={kod}
            onChangeText={(t) => setKod(kodSadelestir(t))}
            placeholder="123456"
            placeholderTextColor={colors.inkMuted}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={10}
            accessibilityLabel={$t('epostaGiris.dogrulama_kodu')}
            editable={!bekliyor}
            style={[styles.input, styles.kod]}
          />
        </View>
      ) : null}

      {gorunum === 'giris' || gorunum === 'kayit' || (gorunum === 'kod' && kodTuru === 'sifre') ? (
        <View>
          <Label>{gorunum === 'kod' ? $t('epostaGiris.yeni_sifre') : $t('epostaGiris.sifre')}</Label>
          <View style={styles.sifreKutu}>
            <TextInput
              ref={sifreKutusu}
              value={sifre}
              onChangeText={setSifre}
              placeholder={gorunum === 'giris' ? '' : $t('epostaGiris.en_az_karakter', { sIFRE_EN_AZ: SIFRE_EN_AZ })}
              placeholderTextColor={colors.inkMuted}
              secureTextEntry={!sifreGorunsun}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={gorunum === 'giris' ? 'current-password' : 'new-password'}
              textContentType={gorunum === 'giris' ? 'password' : 'newPassword'}
              returnKeyType="go"
              onSubmitEditing={() => (gorunum === 'giris' ? girisYap() : gorunum === 'kayit' ? kayitOl() : koduOnayla())}
              accessibilityLabel={gorunum === 'kod' ? $t('epostaGiris.yeni_sifre') : $t('epostaGiris.sifre')}
              editable={!bekliyor}
              style={[styles.input, { flex: 1, borderWidth: 0, backgroundColor: 'transparent' }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={sifreGorunsun ? $t('epostaGiris.sifreyi_gizle') : $t('epostaGiris.sifreyi_goster')}
              onPress={() => setSifreGorunsun((g) => !g)}
              hitSlop={8}
              style={styles.goster}>
              <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.inkMuted }}>{sifreGorunsun ? $t('epostaGiris.gizle') : $t('epostaGiris.goster')}</Txt>
            </Pressable>
          </View>
        </View>
      ) : null}

      {gorunum === 'giris' ? (
        <Button label={bekliyor ? $t('epostaGiris.giris_yapiliyor') : $t('epostaGiris.giris_yap')} onPress={girisYap} disabled={bekliyor} style={{ borderRadius: radius.lg }} />
      ) : gorunum === 'kayit' ? (
        <Button label={bekliyor ? $t('epostaGiris.kod_gonderiliyor') : $t('epostaGiris.hesap_ac')} onPress={kayitOl} disabled={bekliyor} style={{ borderRadius: radius.lg }} />
      ) : gorunum === 'unuttum' ? (
        <Button label={bekliyor ? $t('epostaGiris.gonderiliyor') : $t('epostaGiris.sifirlama_kodu_gonder')} onPress={sifirlamaKoduIste} disabled={bekliyor} style={{ borderRadius: radius.lg }} />
      ) : (
        <Button
          label={bekliyor ? $t('epostaGiris.dogrulaniyor') : kodTuru === 'sifre' ? $t('epostaGiris.sifreyi_degistir_ve_gir') : $t('epostaGiris.dogrula')}
          onPress={koduOnayla}
          disabled={bekliyor}
          style={{ borderRadius: radius.lg }}
        />
      )}

      <View style={styles.baglantilar}>
        {gorunum === 'giris' ? <Baglanti metin={$t('epostaGiris.sifremi_unuttum')} onPress={() => gec('unuttum')} disabled={bekliyor} /> : null}
        {gorunum === 'kod' ? (
          <Baglanti metin={bekleme > 0 ? $t('epostaGiris.kodu_tekrar_gonder_2', { bekleme }) : $t('epostaGiris.kodu_tekrar_gonder')} onPress={tekrarGonder} disabled={bekliyor || bekleme > 0} />
        ) : null}
        <Baglanti
          metin={gorunum === 'giris' || gorunum === 'kayit' ? $t('epostaGiris.diger_giris_yollari') : $t('ortak.geri')}
          onPress={() => (gorunum === 'kod' ? gec(oncekiGorunum) : gorunum === 'unuttum' ? gec('giris') : onVazgec())}
          disabled={bekliyor}
        />
      </View>
    </View>
  );
}

function Baglanti({ metin, onPress, disabled }: { metin: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} hitSlop={8} style={[styles.baglanti, disabled && { opacity: 0.55 }]}>
      <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: colors.inkMuted }}>{metin}</Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  input: { height: 48, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, fontFamily: fontFamily.body, fontSize: 15, color: colors.ink },
  kod: { fontSize: 22, letterSpacing: 6, textAlign: 'center', fontFamily: fontFamily.bodySemiBold },
  sifreKutu: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  goster: { paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  sekmeler: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 3 },
  sekme: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md - 2 },
  sekmeSecili: { backgroundColor: colors.ground },
  baglantilar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: space.lg },
  baglanti: { paddingVertical: space.sm, minHeight: 44, justifyContent: 'center' },
  bilgi: { backgroundColor: colors.seaSoft, borderRadius: radius.md, padding: space.md },
  hata: { backgroundColor: colors.terraSoft, borderRadius: radius.md, padding: space.md },
});
