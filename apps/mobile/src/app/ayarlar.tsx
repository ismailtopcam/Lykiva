import { formatBytes } from '@lykiva/shared';
import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Header } from '@/components/Header';
import { Txt } from '@/components/Txt';
import { Button, Card, Chip, Label, ListRow, ToggleRow } from '@/components/ui';
import { kuyruguGonder, yerelKayitlariTemizle } from '@/kayit/kuyruk';
import { WEB_URL } from '@/lib/baglanti';
import { cevrimdisiDestekleniyor, useIndirilenRotalar } from '@/lib/cevrimdisi';
import { cikisYap, useHesap, type Saglayici } from '@/lib/giris';
import { hesabiSil } from '@/lib/hesap';
import { pushAc, pushDurumu, pushKapat, type PushDurumu } from '@/lib/push';
import { supabase, supabaseHazir } from '@/lib/supabase';
import { colors, space } from '@/theme';
import { $t, cihazDili, DIL_ADLARI, DILLER, dilSecimi, dilSecimiYap, type Dil } from '@/i18n';

const adlar = (): Record<Saglayici, string> => ({ google: 'Google', apple: 'Apple', email: $t('ayarlar.e_posta') });

export default function AyarlarScreen() {
  const hesap = useHesap();
  const [cikiliyor, setCikiliyor] = useState(false);
  const [siliniyor, setSiliniyor] = useState(false);
  const [push, setPush] = useState<PushDurumu | null>(null);
  const indirilenler = useIndirilenRotalar();
  const [isiHaritasinda, setIsiHaritasinda] = useState<boolean | null>(null);

  useEffect(() => {
    if (!hesap?.id) return;
    let acik = true;
    supabase
      .from('profiles')
      .select('isi_haritasinda')
      .eq('id', hesap.id)
      .maybeSingle()
      .then(({ data }) => {
        if (acik && typeof data?.isi_haritasinda === 'boolean') setIsiHaritasinda(data.isi_haritasinda);
      });
    return () => {
      acik = false;
    };
  }, [hesap?.id]);

  async function isiHaritasiDegistir(v: boolean) {
    const once = isiHaritasinda;
    setIsiHaritasinda(v);
    const { error } = await supabase.rpc('isi_haritasi_ayarla', { katil: v });
    if (error) {
      setIsiHaritasinda(once);
      Alert.alert($t('ayarlar.yapilamadi'), error.message);
    }
  }

  // Dil değişince bütün ekranlar yeniden kurulur (kök düzen); kullanıcı Ayarlar'a geri getirilir
  async function dilDegistir(d: Dil | null) {
    if (d === dilSecimi()) return;
    await dilSecimiYap(d);
    setTimeout(() => router.push('/ayarlar'), 50);
  }

  useFocusEffect(
    useCallback(() => {
      let acik = true;
      pushDurumu()
        .then((d) => acik && setPush(d))
        .catch(() => undefined);
      return () => {
        acik = false;
      };
    }, []),
  );

  async function pushDegistir(ac: boolean) {
    try {
      if (ac) setPush(await pushAc());
      else {
        await pushKapat();
        setPush('kapali');
      }
    } catch (e) {
      Alert.alert($t('ayarlar.yapilamadi'), e instanceof Error ? e.message : String(e));
    }
  }

  const pushAlt =
    push === 'acik'
      ? $t('ayarlar.yorum_takip_etkinlik_ve')
      : push === 'reddedildi'
        ? $t('ayarlar.izin_verilmemis_telefonun_ayarlar')
        : push === 'proje-yok'
          ? $t('ayarlar.bu_derlemede_kapali_eas')
          : push === 'desteklenmiyor'
            ? $t('ayarlar.bu_cihazda_kullanilamiyor')
            : $t('ayarlar.uygulama_kapaliyken_de_bildirim');

  async function cik() {
    setCikiliyor(true);
    try {
      // Bekleyen kayıtlar başka hesaba gitmesin: önce göndermeyi dene
      const kalan = await kuyruguGonder().catch(() => -1);
      if (kalan !== 0) {
        Alert.alert(
          $t('ayarlar.gonderilmemis_kayit_var'),
          $t('ayarlar.bu_telefonda_henuz_sunucuya'),
          [
            { text: $t('ortak.vazgec'), style: 'cancel' },
            {
              text: $t('ayarlar.sil_ve_cik'),
              style: 'destructive',
              onPress: () => void cikisVeYonlendir(),
            },
          ],
        );
        return;
      }
      await cikisVeYonlendir();
    } finally {
      setCikiliyor(false);
    }
  }

  async function cikisVeYonlendir() {
    await cikisYap();
    // Önceki hesabın bekleyen kayıtları ve yerel eşleşmeleri sonraki hesaba karışmasın
    await yerelKayitlariTemizle();
    if (router.canDismiss()) router.dismissAll();
    router.replace('/giris');
  }

  function silmeyiSor() {
    const gecici = !!hesap?.gecici;
    Alert.alert(
      $t('ayarlar.hesabin_kalici_olarak_silinsin'),
      $t('ayarlar.ve_ona_bagli_her', { a: gecici ? $t('ayarlar.bu_telefondaki_gecici_hesabin') : $t('ayarlar.hesabin') }),
      [
        { text: $t('ortak.vazgec'), style: 'cancel' },
        { text: $t('ayarlar.kalici_olarak_sil'), style: 'destructive' as const, onPress: () => void sil() },
      ],
    );
  }

  async function sil() {
    setSiliniyor(true);
    try {
      await hesabiSil();
      if (router.canDismiss()) router.dismissAll();
      router.replace('/giris');
      Alert.alert($t('ayarlar.hesabin_silindi'), $t('ayarlar.hesabin_ve_verilerin_silindi'));
    } catch (e) {
      Alert.alert($t('ayarlar.hesap_silinemedi'), e instanceof Error ? e.message : String(e));
    } finally {
      setSiliniyor(false);
    }
  }

  const hesapMetni =
    hesap === undefined
      ? '…'
      : !hesap
        ? $t('ayarlar.oturum_yok')
        : hesap.gecici
          ? $t('ayarlar.gecici_hesap_bu_telefonda')
          : $t('ayarlar.ile_giris_yapildi', { map: hesap.saglayicilar.map((s) => adlar()[s]).join(' + ') });

  return (
    <View style={styles.root}>
      <Header title={$t('ayarlar.ayarlar')} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View>
          <Label>{$t('ayarlar.hesap')}</Label>
          <Card style={{ padding: space.lg, gap: 4 }}>
            <Txt style={{ fontSize: 15 }}>{hesapMetni}</Txt>
            {hesap?.eposta ? <Txt variant="small">{hesap.eposta}</Txt> : null}
          </Card>
        </View>

        <View>
          <Label>{$t('ayarlar.dil_baslik')}</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
            <Chip
              label={$t('ayarlar.telefonun_dili', { dil: DIL_ADLARI[cihazDili()] })}
              role="radio"
              selected={dilSecimi() == null}
              onPress={() => void dilDegistir(null)}
            />
            {DILLER.map((d) => (
              <Chip key={d} label={DIL_ADLARI[d]} role="radio" selected={dilSecimi() === d} onPress={() => void dilDegistir(d)} />
            ))}
          </View>
        </View>

        {push && push !== 'desteklenmiyor' ? (
          <View>
            <Label>{$t('ayarlar.bildirimler')}</Label>
            <Card style={{ paddingHorizontal: space.lg }}>
              <ToggleRow title={$t('ayarlar.telefona_bildirim')} subtitle={pushAlt} value={push === 'acik'} onChange={(v) => void pushDegistir(v)} />
            </Card>
          </View>
        ) : null}

        {supabaseHazir && hesap && isiHaritasinda !== null ? (
          <View>
            <Label>{$t('ayarlar.gizlilik')}</Label>
            <Card style={{ paddingHorizontal: space.lg }}>
              <ToggleRow
                title={$t('ayarlar.isi_haritalarinda_gorun')}
                subtitle={$t('ayarlar.isi_haritalarinda_gorun_alt')}
                value={isiHaritasinda}
                onChange={(v) => void isiHaritasiDegistir(v)}
              />
            </Card>
          </View>
        ) : null}

        {!supabaseHazir ? (
          <Txt variant="muted">{$t('ayarlar.sunucu_anahtari_girilmemis_uygulama')}</Txt>
        ) : hesap?.gecici || !hesap ? (
          <ListRow icon="user" iconTone="terra" caption={$t('ayarlar.kayitlarin_kaybolmasin')} title={$t('ayarlar.giris_yap_ya_da')} href="/giris" />
        ) : (
          <Button variant="outline" label={cikiliyor ? $t('ayarlar.cikis_yapiliyor') : $t('ayarlar.cikis_yap')} onPress={() => void cik()} disabled={cikiliyor} />
        )}

        {cevrimdisiDestekleniyor ? (
          <View>
            <Label>{$t('ayarlar.cevrimdisi_haritalar')}</Label>
            <Card style={{ paddingHorizontal: space.lg }}>
              {indirilenler.length ? (
                indirilenler.map((k) => (
                  <ListRow
                    key={k.rotaId}
                    icon="download"
                    iconTone="sea"
                    caption={formatBytes(k.bayt)}
                    title={k.ad}
                    href={{ pathname: '/rota/[id]', params: { id: k.rotaId } }}
                  />
                ))
              ) : (
                <Txt variant="small" style={{ paddingVertical: space.lg }}>
                  {$t('ayarlar.henuz_indirilen_rota_yok')}</Txt>
              )}
            </Card>
            {indirilenler.length ? (
              <Txt variant="small" style={{ marginTop: 6 }}>
                {$t('ayarlar.toplam_silmek_icin_rotanin', { bytes: formatBytes(indirilenler.reduce((t, k) => t + k.bayt, 0)) })}</Txt>
            ) : null}
          </View>
        ) : null}

        <View>
          <Label>{$t('ayarlar.hakkinda')}</Label>
          <Card style={{ paddingHorizontal: space.lg }}>
            <ListRow icon="shield" iconTone="sea" title={$t('ayarlar.gizlilik_politikasi')} onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}/gizlilik`)} />
            <ListRow icon="lock" iconTone="sea" title={$t('ayarlar.kullanim_kosullari')} onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}/kosullar`)} />
          </Card>
        </View>

        {supabaseHazir && hesap ? (
          <View>
            <Label>{$t('ayarlar.hesabi_sil')}</Label>
            <Card style={{ padding: space.lg, gap: space.md }}>
              <Txt variant="small">{$t('ayarlar.hesabini_ve_ona_bagli')}</Txt>
              <Button variant="outline" label={siliniyor ? $t('ortak.siliniyor') : $t('ayarlar.hesabimi_sil')} onPress={silmeyiSor} disabled={siliniyor || cikiliyor} />
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
});
