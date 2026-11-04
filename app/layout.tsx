import type { Metadata, Viewport } from 'next';
import '../src/styles.css';
import '@fontsource-variable/fredoka';
import '@fontsource-variable/nunito';
import ClientRuntime from '../src/ClientRuntime';

export const metadata: Metadata = {
  title: 'Fabelpad — Jij kiest het avontuur',
  description: 'Jouw eigen voorleeswereld. Kies een kindprofiel en ontdek avonturen die jouw keuzes onthouden.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Fabelpad' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#184d40' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="nl"><body><ClientRuntime />{children}</body></html>;
}
