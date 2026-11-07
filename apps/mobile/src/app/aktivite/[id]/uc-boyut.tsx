import { ScreenShell } from '@/components/ScreenShell';

export default function UcBoyutScreen() {
  return (
    <ScreenShell
      title="İnişli çıkışlı harita"
      plan={[
        'Rotanın üç boyutlu arazi görünümü; yükseklik abartısı 1x / 2x / 3x',
        'Rota boyunca kaydırınca: konum (km), yükseklik, eğim, hız',
        'Kamerayı döndürme',
        'Uçuş videosu oluşturma (hikâyede paylaşmak için)',
      ]}
    />
  );
}
