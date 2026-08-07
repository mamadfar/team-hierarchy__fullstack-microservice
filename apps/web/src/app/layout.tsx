import type { Metadata } from 'next';
import { Sora, Source_Sans_3 } from 'next/font/google';
import { getLocale, getMessages } from 'next-intl/server';
import { Providers } from '@/components/providers';
import './globals.css';

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora-next',
  display: 'swap',
});

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-source-next',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Orbit — Team Atlas',
  description: 'Team discovery and ticket routing across the group.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} suppressHydrationWarning className={`${sora.variable} ${sourceSans.variable}`}>
      <body>
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
