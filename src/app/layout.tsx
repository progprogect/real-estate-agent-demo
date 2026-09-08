import type { Metadata, Viewport } from 'next';
import { Fraunces, Archivo } from 'next/font/google';
import './globals.css';
import { t } from '@/lib/strings';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  weight: ['500', '600'],
  style: ['normal', 'italic'],
});

const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: t.appName,
  description: t.appTagline,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#f5f2ea',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${archivo.variable}`}>
      <body>
        <div className="mx-auto min-h-dvh max-w-[480px]">{children}</div>
      </body>
    </html>
  );
}
