import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/current.js';
import { BRANDING } from '@/config/branding.js';
import { LoginForm } from '@/features/auth/LoginForm.jsx';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }) {
  if (await getCurrentUser()) redirect('/dashboard');
  const { next } = await searchParams;
  const safeNext =
    typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')
      ? next
      : '/dashboard';
  return (
    <main className="flex min-h-screen items-center justify-center bg-page p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <Image src={BRANDING.logo} alt="" width={40} height={40} className="rounded-lg" />
          <div>
            <h1 className="text-lg font-semibold">{BRANDING.productName}</h1>
            <p className="text-xs text-muted">{BRANDING.companyName}</p>
          </div>
        </div>
        <LoginForm next={safeNext} />
        <p className="mt-6 text-center text-xs text-muted">
          No account or forgot your password? Please contact HR.
        </p>
      </div>
    </main>
  );
}
