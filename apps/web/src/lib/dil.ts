/**
 * Web sayfalarının dili: `?dil=en` verilmişse o, yoksa tarayıcının dili (Accept-Language).
 * Başlık yoksa (WhatsApp vb. önizleme botları çoğu zaman göndermez) Türkçe.
 * Yasal sayfalar ve yönetim paneli Türkçe kalır.
 */
import { acceptLanguage, dilMi, dilSec, type Dil } from '@lykiva/shared';
import { headers } from 'next/headers';

export async function istekDili(arama?: Promise<Record<string, string | string[] | undefined>>): Promise<Dil> {
  const q = arama ? (await arama).dil : undefined;
  if (dilMi(q)) return q;
  const liste = acceptLanguage((await headers()).get('accept-language'));
  return liste.length ? dilSec(liste) : 'tr';
}

/** Open Graph için: tr_TR, en_GB, de_DE, ru_RU */
export const OG_YEREL: Record<Dil, string> = { tr: 'tr_TR', en: 'en_GB', de: 'de_DE', ru: 'ru_RU' };
