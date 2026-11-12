/**
 * Kilit ekranında süren kaydın penceresi — iOS (Live Activity; kilit ekranı ve Dynamic Island).
 * Android karşılığı `index.ts`; Metro platforma göre seçer, TypeScript tipleri `index.ts`'ten alır.
 *
 * Pencere expo-widgets ile çizilir: `KayitPenceresi` 'widget' yönergesiyle derlemede metne çevrilir ve
 * widget eklentisinin (ExpoWidgetsTarget) içinde ayrı bir JS ortamında çalışır. O yüzden fonksiyon dışarıdaki
 * hiçbir şeye (sabit, yardımcı) erişemez; her şey props'tan gelir. Süre telefonda kendi kendine sayar
 * (SwiftUI timer); mesafe, anlık ve ortalama hız her güncellemede yenilenir.
 *
 * expo-widgets yerel modülü olmayan derlemelerde (Expo Go, eski geliştirme derlemesi) hiçbir şey yapmaz.
 * Live Activity yalnızca uygulama öndeyken başlatılabilir (kayıt uygulamadan başladığı için sorun değil);
 * kullanıcı ayarlardan kapattıysa başlatma hata verir ve sessizce geçilir.
 */
import { HStack, Image, type ImageProps, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { requireOptionalNativeModule } from 'expo';
import type { LiveActivity, LiveActivityEnvironment, LiveActivityFactory } from 'expo-widgets';
import type { ReactNode } from 'react';

import type { KilitEkraniDurumu } from './tipler';

export type { KilitEkraniDurumu } from './tipler';

type Simge = NonNullable<ImageProps['systemName']>;

/** Pencereye giden değerler (JSON olarak gider; tarih yerine ms) */
type PencereProps = {
  baslik: string;
  simge: Simge;
  /** Süre sayacının başlangıcı: şimdi - geçen süre (ms) */
  baslangic: number;
  /** Duraklatıldıysa sayacın durduğu an (ms), sayıyorsa null */
  durak: number | null;
  mesafe: string;
  mesafeBirim: string;
  /** Anlık hız ("—": bilinmiyor) */
  anlik: string;
  /** Ortalama hız */
  hiz: string;
  hizBirim: string;
  sureEtiket: string;
  mesafeEtiket: string;
  anlikEtiket: string;
  hizEtiket: string;
};

const KayitPenceresi = (p: PencereProps, env: LiveActivityEnvironment) => {
  'widget';
  const vurgu = env.isLuminanceReduced ? '#FFFFFF' : '#B04E25';
  const ikincil = { type: 'hierarchical', style: 'secondary' } as const;
  const sure = (boyut: number) => (
    <Text
      timerInterval={{ lower: new Date(p.baslangic), upper: new Date(p.baslangic + 24 * 60 * 60 * 1000) }}
      countsDown={false}
      pauseTime={p.durak == null ? undefined : new Date(p.durak)}
      modifiers={[font({ size: boyut, weight: 'semibold' }), monospacedDigit(), lineLimit(1)]}
    />
  );
  const deger = (d: string, birim: string, boyut: number) => (
    <HStack alignment="firstTextBaseline" spacing={2}>
      <Text modifiers={[font({ size: boyut, weight: 'semibold' }), monospacedDigit(), lineLimit(1)]}>{d}</Text>
      <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(ikincil), lineLimit(1)]}>{birim}</Text>
    </HStack>
  );
  const etiket = (e: string) => (
    <Text modifiers={[font({ textStyle: 'caption2' }), foregroundStyle(ikincil), lineLimit(1)]}>{e}</Text>
  );
  const sutun = (icerik: ReactNode, e: string) => (
    <VStack alignment="leading" spacing={2} modifiers={[frame({ maxWidth: 10000, alignment: 'leading' })]}>
      {icerik}
      {etiket(e)}
    </VStack>
  );

  return {
    banner: (
      <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 14 })]}>
        <HStack spacing={8}>
          <Image systemName={p.simge} size={15} color={vurgu} />
          <Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' }), lineLimit(1)]}>{p.baslik}</Text>
          <Spacer />
        </HStack>
        <HStack alignment="top" spacing={12}>
          {sutun(sure(22), p.sureEtiket)}
          {sutun(deger(p.mesafe, p.mesafeBirim, 22), p.mesafeEtiket)}
        </HStack>
        <HStack alignment="top" spacing={12}>
          {sutun(deger(p.anlik, p.hizBirim, 22), p.anlikEtiket)}
          {sutun(deger(p.hiz, p.hizBirim, 22), p.hizEtiket)}
        </HStack>
      </VStack>
    ),
    compactLeading: <Image systemName={p.simge} size={14} color={vurgu} />,
    compactTrailing: (
      <HStack modifiers={[frame({ maxWidth: 56, alignment: 'trailing' })]}>{sure(14)}</HStack>
    ),
    minimal: <Image systemName={p.simge} size={12} color={vurgu} />,
    expandedLeading: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ leading: 6, top: 4 })]}>
        {deger(p.mesafe, p.mesafeBirim, 20)}
        {etiket(p.mesafeEtiket)}
      </VStack>
    ),
    expandedTrailing: (
      <VStack alignment="trailing" spacing={2} modifiers={[padding({ trailing: 6, top: 4 })]}>
        {deger(p.anlik, p.hizBirim, 20)}
        {etiket(p.anlikEtiket)}
      </VStack>
    ),
    expandedBottom: (
      <HStack spacing={8} modifiers={[padding({ leading: 6, trailing: 6, bottom: 4 })]}>
        <Image systemName={p.simge} size={14} color={vurgu} />
        {sure(22)}
        <Spacer />
        <VStack alignment="trailing" spacing={2}>
          {deger(p.hiz, p.hizBirim, 15)}
          {etiket(p.hizEtiket)}
        </VStack>
      </HStack>
    ),
  };
};

const SIMGELER: Record<string, Simge> = {
  bike: 'figure.outdoor.cycle',
  mtb: 'bicycle',
  run: 'figure.run',
  walk: 'figure.walk',
  hike: 'figure.hiking',
  trail_run: 'figure.run',
};

export const kilitEkraniVar = requireOptionalNativeModule('ExpoWidgets') != null;

let fabrika: LiveActivityFactory<PencereProps> | null | undefined;
let etkin: LiveActivity<PencereProps> | null = null;

/** expo-widgets yalnızca yerel modül varken yüklenir: yoksa içe aktarmak uygulamayı düşürür */
function fabrikaAl(): LiveActivityFactory<PencereProps> | null {
  if (fabrika !== undefined) return fabrika;
  fabrika = null;
  if (!kilitEkraniVar) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const widgets = require('expo-widgets') as typeof import('expo-widgets');
    fabrika = widgets.createLiveActivity<PencereProps>('LykivaKayit', KayitPenceresi);
  } catch {
    fabrika = null;
  }
  return fabrika;
}

function props(d: KilitEkraniDurumu): PencereProps {
  const simdi = Date.now();
  return {
    baslik: d.baslik,
    simge: SIMGELER[d.etkinlik] ?? 'figure.outdoor.cycle',
    baslangic: simdi - Math.max(0, d.gecenMs),
    durak: d.sayiyor ? null : simdi,
    mesafe: d.mesafe,
    mesafeBirim: d.mesafeBirim,
    anlik: d.anlik,
    hiz: d.hiz,
    hizBirim: d.hizBirim,
    sureEtiket: d.sureEtiket,
    mesafeEtiket: d.mesafeEtiket,
    anlikEtiket: d.anlikEtiket,
    hizEtiket: d.hizEtiket,
  };
}

export function kilitEkraniGuncelle(durum: KilitEkraniDurumu): void {
  const f = fabrikaAl();
  if (!f) return;
  const p = props(durum);
  try {
    if (!etkin) {
      // Uygulama yeniden açıldıysa (JS yenilendi, kayıt geri yüklendi) önceki pencere sürüyor olabilir
      const onceki = f.getInstances();
      etkin = onceki[0] ?? null;
      for (const e of onceki.slice(1)) e.end('immediate').catch(() => {});
    }
    if (etkin) {
      const bu = etkin;
      bu.update(p).catch(() => {
        // Kullanıcı pencereyi kaldırdı ya da sistem bitirdi: bir sonraki güncellemede yeniden açılır
        if (etkin === bu) etkin = null;
      });
    } else {
      etkin = f.start(p);
    }
  } catch {
    // Live Activity kapalı ya da uygulama arka planda (başlatılamaz); kayıt etkilenmez
    etkin = null;
  }
}

export function kilitEkraniKapat(): void {
  const f = fabrikaAl();
  if (!f) return;
  etkin = null;
  try {
    for (const e of f.getInstances()) e.end('immediate').catch(() => {});
  } catch {
    // yok sayılır
  }
}
