import type { Metadata } from 'next';

import { SiteHeader } from '@/components/site-header';
import { getCurrentUser } from '@/modules/auth/session';
import { toPublicUser } from '@/modules/users/user.model';

import './globals.css';

export const metadata: Metadata = {
  title: 'Job Application Tracker',
  description: 'Post jobs, apply with a resume, and track application status.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body className="min-h-screen">
        <SiteHeader user={user ? toPublicUser(user) : null} />
        {children}
      </body>
    </html>
  );
}
