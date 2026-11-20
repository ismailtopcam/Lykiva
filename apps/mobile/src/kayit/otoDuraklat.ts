/**
 * Otomatik duraklatma ayarı (varsayılan açık): kayıt sürerken durunca kayıt kendiliğinden duraklar, hareket edince
 * sürer. Kararı `@lykiva/shared` > `otoDurak` verir, kaydedici uygular. Ayarlar > Kayıt'tan kapatılabilir
 * (seçim telefonda saklanır).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

const AYAR_DEPO = 'lykiva.oto-duraklat.v1';

let acik = true;
let ayarYuklendi = false;
const dinleyiciler = new Set<() => void>();

function ayariYukle() {
  if (ayarYuklendi) return;
  ayarYuklendi = true;
  AsyncStorage.getItem(AYAR_DEPO)
    .then((s) => {
      if (s === '0' && acik) {
        acik = false;
        dinleyiciler.forEach((f) => f());
      }
    })
    .catch(() => undefined);
}
// Arka plan görevinde de ilk konumdan önce okunsun
if (Platform.OS !== 'web') ayariYukle();

/** Kaydedici için (bileşen dışı) */
export function otoDuraklatAcik(): boolean {
  return acik;
}

export function useOtoDuraklatAcik(): boolean {
  return useSyncExternalStore(
    (f) => {
      ayariYukle();
      dinleyiciler.add(f);
      return () => {
        dinleyiciler.delete(f);
      };
    },
    () => acik,
    () => acik,
  );
}

export function otoDuraklatAyarla(v: boolean) {
  ayarYuklendi = true;
  acik = v;
  dinleyiciler.forEach((f) => f());
  void AsyncStorage.setItem(AYAR_DEPO, v ? '1' : '0').catch(() => undefined);
}
