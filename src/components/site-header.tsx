import Link from 'next/link';

import { LogoutButton } from '@/components/logout-button';
import type { PublicUser } from '@/modules/users/user.model';

const HR_LINKS = [{ href: '/hr/jobs', label: 'My listings' }];

const CANDIDATE_LINKS = [
  { href: '/jobs', label: 'Browse jobs' },
  { href: '/applications', label: 'My applications' },
  { href: '/profile', label: 'Profile' },
];

export function SiteHeader({ user }: { user: PublicUser | null }) {
  const links = user?.role === 'HR' ? HR_LINKS : user ? CANDIDATE_LINKS : [];

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
        <Link href="/" className="text-base font-semibold text-slate-900">
          Job Application Tracker
        </Link>

        <nav className="flex flex-1 flex-wrap items-center gap-4 text-sm">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-slate-600 hover:text-brand-600">
              {link.label}
            </Link>
          ))}
        </nav>

        {user ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">
              {user.name}
              <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {user.role}
              </span>
            </span>
            <LogoutButton />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn-secondary">
              Log in
            </Link>
            <Link href="/signup" className="btn-primary">
              Sign up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
