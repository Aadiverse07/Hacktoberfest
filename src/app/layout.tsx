import './globals.css';
import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import { Providers } from './providers';
import { NovaPayScrollMotion } from '@/components/novapay-scroll-motion';

const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat', display: 'swap' });

export const metadata: Metadata = { title: 'Tradetide - Accounting', description: 'Double-entry accounting workspace' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" dir="ltr" className={montserrat.variable} suppressHydrationWarning>
      <body>
        <Providers><NovaPayScrollMotion />{children}</Providers>
      </body>
    </html>
  );
}
