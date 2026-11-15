/**
 * Canlı konum sayfasının tarayıcıdan yokladığı veri (anon anahtar sunucuda kalır). Hiç önbelleğe alınmaz.
 */
import { canliVeriGetir } from '@/lib/canli';

export async function GET(_istek: Request, { params }: RouteContext<'/c/[anahtar]/veri'>) {
  const { anahtar } = await params;
  const s = await canliVeriGetir(anahtar);
  const basliklar = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
  if (s.durum === 'yok') return Response.json(null, { status: 404, headers: basliklar });
  if (s.durum === 'hata') return Response.json(null, { status: 502, headers: basliklar });
  return Response.json(s.v, { headers: basliklar });
}
