import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Yönetim',
  robots: { index: false, follow: false },
};

/** Giriş sayfası ve panel ortak kabuğu; panelin kenar çubuğu (panel)/layout.tsx içinde */
export default function AdminKokLayout({ children }: LayoutProps<'/admin'>) {
  return children;
}
