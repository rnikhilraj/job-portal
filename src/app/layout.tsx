import type { Metadata } from 'next';
import { Archivo, IBM_Plex_Sans } from 'next/font/google';

import { RouteTransition } from '@/components/route-transition';
import { SiteHeader } from '@/components/site-header';
import { getCurrentUser } from '@/modules/auth/session';
import { toPublicUser } from '@/modules/users/user.model';

import './globals.css';

/**
 * Both faces are self-hosted at build time by next/font, so there is no
 * request to a font CDN at runtime and no flash of unstyled text.
 *
 * Archivo is the display face: a sturdy grotesque with presence at large sizes,
 * used only for headings and figures. IBM Plex Sans carries the body, because
 * this app is mostly dense reading — job descriptions, applicant lists, forms —
 * and Plex was drawn for exactly that.
 */
const display = Archivo({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['600', '700'],
  display: 'swap',
});

const body = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Shortlist',
    template: '%s · Shortlist',
  },
  description: 'Post listings, apply with a resume, and track application status.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="flex min-h-screen flex-col font-sans">
        <a
          href="#main"
          className="sr-only-focusable absolute left-4 top-4 z-50 rounded-md bg-petrol-700
            px-4 py-2 text-sm font-medium text-white"
        >
          Skip to content
        </a>

        <SiteHeader user={user ? toPublicUser(user) : null} />

        {/* Below the header, so navigation itself never flickers on route change. */}
        <div id="main" className="flex-1">
          <RouteTransition>{children}</RouteTransition>
        </div>

        <footer className="border-t border-mist-300 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-ink-muted sm:px-6">
            Shortlist — a demo hiring platform. Built to make waiting less awful.
          </div>
        </footer>
      </body>
    </html>
  );
}
