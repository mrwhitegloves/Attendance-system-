'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Camera,
  CalendarCheck,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Moon,
  Plane,
  ScrollText,
  Settings,
  Sun,
  UserRound,
  Users,
} from 'lucide-react';
import { NAVIGATION } from '@/config/navigation.js';
import { BRANDING } from '@/config/branding.js';
import { apiFetch } from '@/lib/apiFetch.js';
import { Avatar } from '@/components/shared/Avatar.jsx';
import { DeviceSetup } from '@/features/notifications/DeviceSetup.jsx';

const ICONS = {
  Camera,
  CalendarCheck,
  FolderOpen,
  LayoutDashboard,
  Plane,
  ScrollText,
  Settings,
  UserRound,
  Users,
};

/** The frame of every signed-in screen: black sidebar on wide screens, bottom bar on phones. */
export function AppShell({ user, permissions, roleLabel, vapidPublicKey, children }) {
  const pathname = usePathname();
  const items = NAVIGATION.filter((item) => item.show(permissions));
  const isActive = (href) =>
    href === '/attendance'
      ? pathname === '/attendance' ||
        (pathname.startsWith('/attendance/') && !pathname.startsWith('/attendance/punch'))
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-screen md:pl-60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-sidebar text-white md:flex">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-5 py-5">
          <Image src={BRANDING.logo} alt="" width={32} height={32} className="rounded-md" />
          <span className="leading-tight">
            <span className="block text-sm font-semibold">{BRANDING.productName}</span>
            <span className="block text-[11px] text-white/50">{BRANDING.companyName}</span>
          </span>
        </Link>
        <nav className="flex-1 space-y-0.5 px-3" aria-label="Main">
          {items.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-brand text-white'
                    : 'text-white/65 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <UserBox user={user} roleLabel={roleLabel} dark />
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image src={BRANDING.logo} alt="" width={28} height={28} className="rounded-md" />
          <span className="text-sm font-semibold">{BRANDING.productName}</span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeButton />
          <Link href="/me" aria-label="My profile">
            <Avatar name={user.name} size="sm" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-5 sm:px-6 md:pb-10 md:pt-8">{children}</main>

      <nav
        className="pb-safe fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface md:hidden"
        aria-label="Main"
      >
        {items
          .filter((item) => item.mobile)
          .map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${active ? 'text-brand' : 'text-muted'}`}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
      </nav>

      <DeviceSetup user={user} canPunch={permissions.punch} vapidPublicKey={vapidPublicKey} />
    </div>
  );
}

function UserBox({ user, roleLabel }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const signOut = async () => {
    setBusy(true);
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.replace('/login');
    router.refresh();
  };
  return (
    <div className="flex items-center gap-2.5">
      <Link
        href="/me"
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 hover:bg-white/10"
      >
        <Avatar name={user.name} size="sm" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{user.name}</span>
          <span className="block truncate text-[11px] text-white/50">{roleLabel}</span>
        </span>
      </Link>
      <ThemeButton dark />
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        className="rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut size={17} />
      </button>
    </div>
  );
}

/** Switches light / dark and remembers the choice on this device. */
export function ThemeButton({ dark }) {
  const toggle = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    if (next === 'dark') document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Private mode: the choice lasts until the page closes.
    }
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className={`rounded-md p-1.5 ${dark ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-muted hover:bg-raised'}`}
      aria-label="Switch light or dark mode"
      title="Light / dark"
    >
      <Sun size={17} className="hidden dark:block" />
      <Moon size={17} className="dark:hidden" />
    </button>
  );
}
