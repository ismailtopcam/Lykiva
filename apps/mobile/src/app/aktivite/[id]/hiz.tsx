import { ScreenShell } from '@/components/ScreenShell';

export default function HizMolalarScreen() {
  return (
    <ScreenShell
      title="Hız & molalar"
      plan={[
        'Maksimum / ortalama / minimum hız kartları ve nerede ölçüldükleri',
        'Zamana göre hız grafiği; mola aralıkları gölgeli, ortalama çizgisi',
        '"Nerede durdun?" — mola listesi: saat, km, süre, fotoğraflar',
        'Kısa duraklamalar (1 dakikadan kısa) ayrı gruplanır',
      ]}
    />
  );
}
