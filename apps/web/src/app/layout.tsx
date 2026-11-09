import '@fontsource-variable/inter';
import '@fontsource-variable/bricolage-grotesque';
import type { Metadata } from 'next';

import { themeVars } from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = {
  // Paylaşım önizleme görsellerinin (og:image) tam adresi için; sunucuda localhost çıkmasın
  metadataBase: new URL(process.env.SITE_URL || 'https://lykiva.ismailtopcam.dev'),
  title: {
    default: 'Lykiva — Rotanı kaydet, birlikte yol al',
    template: '%s · Lykiva',
  },
  description:
    'Bisiklet, koşu, yürüyüş ve doğa sporları için aktivite takibi, rota paylaşımı, gruplar ve etkinlikler.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="tr" style={themeVars}>
      <body>{children}</body>
    </html>
  );
}
