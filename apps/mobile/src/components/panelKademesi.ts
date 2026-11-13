/**
 * Parmakla sürüklenen bilgi paneli (Harita sekmesi ve egzersiz kaydı): tek uzun sayfa, kademeler o sayfanın bölümleri.
 *
 * Panelin içeriği hep aynıdır ve hepsi çizilir; bölümler üstten alta sıralanır (1. kademe en üstte). Panel ekranın
 * altına yaslı, görünen yüksekliği tek bir Animated değeri ve taşanı keser: panel büyüdükçe aynı sayfanın aşağıdaki
 * bölümleri görünür. Kademe = "şu bölümün sonuna kadar göster" durağı.
 * - Sürüklerken yalnızca yükseklik parmağı izler; ekran yeniden çizilmez, içerik değişmez.
 * - Bırakınca parmağın hızına göre ileri atılan noktaya en yakın durağa yumuşakça oturur (içerik değişmediği için
 *   titreme olmaz). En üst / en alt durağın ötesine lastik gibi az gider.
 * - Bölümlerin boyu kendiliğinden değişirse (yol yüklendi, uyarı çıktı) panel o kademenin yeni durağına kayar.
 *
 * Kullanım: panel `Animated.View`'ine `stil` verilir; içinde iç boşluklu tek bir `View`, onun doğrudan çocukları
 * bölümlerdir ve her bölüme `onLayout={bolum[i]}` bağlanır. `surukle.panHandlers` sürükleme alanına verilir.
 */
import { useEffect, useState } from 'react';
import { Animated, Easing, PanResponder, type LayoutChangeEvent } from 'react-native';

/** Bırakırken parmağın hızı kadar ileri atılan nokta (ms): hızlı fırlatma bir sonraki durağa gider */
const ATILIM_MS = 180;
/** Durakların ötesine çekince panel lastik gibi az gelsin */
const LASTIK = 0.25;
const SURE_MS = 260;
/** En fazla bu kadar bölüm */
const EN_FAZLA_BOLUM = 5;

type Ayarlar = {
  /** Açılıştaki kademe (0'dan) */
  ilk: number;
  /** Kademe (bölüm) sayısı; içerik değiştikçe değişebilir */
  sayi: number;
  /** Son bölümün altındaki iç boşluk (px): durak = bölümün sonu + bu */
  altBosluk: number;
  /** Verilirse son kademe bu yükseklikte durur (ör. tam ekran) */
  sonYukseklik?: number | null;
};

export function usePanelKademesi({ ilk, sayi, altBosluk, sonYukseklik = null }: Ayarlar) {
  const [kademe, setKademe] = useState(ilk);
  // Oturulan durağın yüksekliği (harita dolgusu için); sürüklerken değişmez
  const [gorunenH, setGorunenH] = useState(0);
  // İlk ölçüden önce panel görünmez (bir kare bütün içerik görünmesin)
  const [olculdu, setOlculdu] = useState(false);

  const [api] = useState(() => {
    const yukseklik = new Animated.Value(0);
    // Aşağıdakiler yalnızca bu kapanışta tutulur (çizimde okunmaz)
    const ayar = { sayi: Math.max(1, sayi), altBosluk, son: sonYukseklik };
    const bitis: (number | undefined)[] = [];
    // Kullanıcının seçtiği kademe; bölüm sayısı geçici azalsa da (ör. yol yüklenirken) korunur
    let istenen = ilk;
    let simdiki = Math.min(ilk, ayar.sayi - 1);
    let surukluyor = false;
    let basH = 0;
    let olcumVar = false;
    let yerlesmeBekliyor = false;

    const sinirla = (k: number) => Math.min(ayar.sayi - 1, Math.max(0, k));
    /** k. kademenin yüksekliği: k. bölümün sonu + alt boşluk (ölçülmediyse bir önceki durak) */
    const durak = (k: number): number => {
      if (k === ayar.sayi - 1 && ayar.son != null) return ayar.son;
      const b = bitis[k];
      const onceki = k > 0 ? durak(k - 1) : 0;
      return b === undefined ? onceki : Math.max(onceki, b + ayar.altBosluk);
    };

    /** Kullanıcı bir kademe seçti (sürükleyip bıraktı, erişilebilirlik hareketi) */
    const sec = (k: number) => {
      istenen = sinirla(k);
      oturt(istenen);
    };

    const oturt = (k: number, animasyonlu = true) => {
      simdiki = sinirla(k);
      const h = durak(simdiki);
      setKademe(simdiki);
      setGorunenH(Math.round(h));
      if (animasyonlu) {
        Animated.timing(yukseklik, { toValue: h, duration: SURE_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
      } else {
        yukseklik.setValue(h);
      }
    };

    /** Bölümler ölçüldükçe (ya da ayar değişince) panel o anki kademenin durağına */
    const yenile = () => {
      if (!olcumVar || surukluyor) return;
      if (yerlesmeBekliyor) return;
      oturt(simdiki);
    };

    const bolum = Array.from({ length: EN_FAZLA_BOLUM }, (_v, i) => (e: LayoutChangeEvent) => {
      const { y, height } = e.nativeEvent.layout;
      bitis[i] = y + height;
      if (!olcumVar) {
        // İlk açılışta bütün bölümlerin ölçüsü aynı anda gelir; hepsi gelince animasyonsuz yerleş
        olcumVar = true;
        yerlesmeBekliyor = true;
        setTimeout(() => {
          yerlesmeBekliyor = false;
          oturt(simdiki, false);
          setOlculdu(true);
        }, 0);
        return;
      }
      yenile();
    });

    const ayarla = (sayi: number, altBosluk: number, son: number | null) => {
      ayar.sayi = Math.max(1, sayi);
      ayar.altBosluk = altBosluk;
      ayar.son = son;
      // Bölüm sayısı azaldıysa artık olmayan bölümlerin ölçüsü unutulur
      bitis.length = Math.min(bitis.length, ayar.sayi);
      simdiki = sinirla(istenen);
      yenile();
    };

    const surukle = PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      // Sürükleme başladıysa harita ya da başka bir öğe parmağı elinden almasın
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        surukluyor = true;
        yukseklik.stopAnimation((v) => {
          basH = v;
        });
      },
      onPanResponderMove: (_e, g) => {
        const enAz = durak(0);
        const enCok = durak(ayar.sayi - 1);
        let h = basH - g.dy;
        if (h > enCok) h = enCok + (h - enCok) * LASTIK;
        else if (h < enAz) h = enAz - (enAz - h) * LASTIK;
        yukseklik.setValue(h);
      },
      onPanResponderRelease: (_e, g) => {
        surukluyor = false;
        // Parmağın hızıyla ileri atılan noktaya en yakın durak
        const hedefH = basH - g.dy - g.vy * ATILIM_MS;
        let enYakin = 0;
        for (let k = 1; k < ayar.sayi; k++) {
          if (Math.abs(durak(k) - hedefH) < Math.abs(durak(enYakin) - hedefH)) enYakin = k;
        }
        sec(enYakin);
      },
      onPanResponderTerminate: () => {
        surukluyor = false;
        oturt(simdiki);
      },
    });

    return {
      surukle,
      bolum,
      ayarla,
      buyut: () => sec(simdiki + 1),
      kucult: () => sec(simdiki - 1),
      yukseklik,
    };
  });

  useEffect(() => {
    api.ayarla(sayi, altBosluk, sonYukseklik);
  }, [api, sayi, altBosluk, sonYukseklik]);

  return {
    kademe: Math.min(kademe, Math.max(0, sayi - 1)),
    gorunenH,
    surukle: api.surukle,
    bolum: api.bolum,
    buyut: api.buyut,
    kucult: api.kucult,
    stil: olculdu ? { height: api.yukseklik, overflow: 'hidden' as const } : { opacity: 0 },
  };
}
