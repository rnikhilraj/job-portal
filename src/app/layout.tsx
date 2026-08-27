import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Job Application Tracker',
  description: 'Post jobs, apply with a resume, and track application status.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
