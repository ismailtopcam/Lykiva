/**
 * Gizlilik kontrolleri ve engelleme (sunucu: 20261115000000_gizlilik.sql, 20261116000000_ek_gizlilik.sql).
 * Ayarlar kişinin kendi profil satırından okunur, fonksiyonlarla değiştirilir.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { useHesap } from '@/lib/giris';
import { oturumuSagla, supabase } from '@/lib/supabase';
import { $t } from '@/i18n';

export type Duzey = 'herkes' | 'takipciler' | 'kimse';
export const DUZEYLER: Duzey[] = ['herkes', 'takipciler', 'kimse'];
export const duzeyAdi = (d: Duzey) => ({ herkes: $t('gizlilik.herkes'), takipciler: $t('gizlilik.takipciler'), kimse: $t('gizlilik.kimse') })[d];

export type DuzeyAlani = 'profil_gizliligi' | 'aktivite_gizliligi' | 'grup_aktivite_gizliligi' | 'bahsetme_izni' | 'meydan_okuma_gizliligi';
export type Bayrak = 'uclari_gizle' | 'gizli_hiz' | 'gizli_molalar' | 'kisisel_veri_paylasimi_kapali';

export type GizlilikAyarlari = Record<DuzeyAlani, Duzey> & Record<Bayrak, boolean> & { isi_haritasinda: boolean };

const SUTUNLAR =
  'profil_gizliligi,aktivite_gizliligi,grup_aktivite_gizliligi,bahsetme_izni,meydan_okuma_gizliligi,uclari_gizle,gizli_hiz,gizli_molalar,kisisel_veri_paylasimi_kapali,isi_haritasinda';

/** Kendi gizlilik ayarların; `degistir` ekranı hemen günceller (sunucu hatasında geri al) */
export function useGizlilikAyarlari() {
  const hesap = useHesap();
  const [ayar, setAyar] = useState<GizlilikAyarlari | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    if (!hesap?.id || hesap.gecici) return;
    let acik = true;
    supabase
      .from('profiles')
      .select(SUTUNLAR)
      .eq('id', hesap.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!acik) return;
        if (error || !data) setHata(error?.message ?? $t('ortak.yuklenemedi'));
        else setAyar(data as unknown as GizlilikAyarlari);
      });
    return () => {
      acik = false;
    };
  }, [hesap?.id, hesap?.gecici]);

  const degistir = useCallback((d: Partial<GizlilikAyarlari>) => setAyar((x) => (x ? { ...x, ...d } : x)), []);

  /** Açık / kapalı ayarı kaydeder; sunucu reddederse eski haline döner ve uyarır */
  const bayrak = useCallback(
    async (alan: Bayrak, deger: boolean) => {
      degistir({ [alan]: deger });
      try {
        await bayrakAyarla(alan, deger);
      } catch (e) {
        degistir({ [alan]: !deger });
        Alert.alert($t('ayarlar.yapilamadi'), e instanceof Error ? e.message : String(e));
      }
    },
    [degistir],
  );

  return { hesap, ayar, hata, degistir, bayrak, girisGerekli: !hesap || !!hesap.gecici };
}

async function rpc<T>(ad: string, args: Record<string, unknown>): Promise<T> {
  await oturumuSagla();
  const { data, error } = await supabase.rpc(ad, args);
  if (error) throw new Error(error.message);
  return data as T;
}

/** Dönen: değişen aktivite sayısı (yalnızca aktivitelerde geçmişe uygulanınca) */
export const duzeyAyarla = (alan: DuzeyAlani, deger: Duzey, gecmiseUygula = false) =>
  rpc<number>('gizlilik_ayarla', { alan, deger, gecmise_uygula: gecmiseUygula });

export const bayrakAyarla = (alan: Bayrak, deger: boolean) => rpc<null>('gizlilik_bayragi_ayarla', { alan, deger });

export const isiHaritasiAyarla = (katil: boolean) => rpc<null>('isi_haritasi_ayarla', { katil });

export type GecmisGorunurluk = 'public' | 'followers' | 'groups' | 'private';

/** Bütün aktivitelerine uygular; null verilen değişmez. Dönen: değişen aktivite sayısı */
export const gecmisiDuzenle = (gorunurluk: GecmisGorunurluk | null, uclariGizle: boolean | null) =>
  rpc<number>('gecmis_aktiviteleri_duzenle', { gorunurluk, uclari_gizle: uclariGizle });

export type EngellenenKisi = { id: string; display_name: string; username: string; avatar_url: string | null; created_at: string };

export const engellenenler = () => rpc<EngellenenKisi[]>('engellenenler', {});
export const kisiEngelle = (kisi: string, engelle: boolean) => rpc<null>('kisi_engelle', { kisi, engelle });
